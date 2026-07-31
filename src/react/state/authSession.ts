import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, validateCredentials } from '../services/feeds';
import type { Credentials } from '../types';
import type { AuthContextValue, AuthStatus } from './authContext';
import {
  readStoredCredentials,
  removeStoredCredentials,
  writeStoredCredentials,
} from './authStorage';

interface AuthSessionState {
  credentials: Credentials | null;
  status: AuthStatus;
}

export function useAuthSession(): AuthContextValue {
  const [storedCredentials] = useState(readStoredCredentials);
  const [session, setSession] = useState<AuthSessionState>(() => ({
    credentials: null,
    status: storedCredentials ? 'checking' : 'anonymous',
  }));

  useEffect(() => {
    if (!storedCredentials) return;

    let active = true;
    restoreAuthSession(storedCredentials).then((credentials) => {
      if (!active) return;
      setSession({ credentials, status: 'authenticated' });
    }).catch(() => {
      if (!active) return;
      setSession({ credentials: null, status: 'anonymous' });
    });

    return () => {
      active = false;
    };
  }, [storedCredentials]);

  const authenticate = useCallback(async (credentials: Credentials) => {
    await authenticateAuthSession(credentials);
    setSession({ credentials, status: 'authenticated' });
  }, []);

  const clearCredentials = useCallback(() => {
    clearAuthSession();
    setSession({ credentials: null, status: 'anonymous' });
  }, []);

  return useMemo(() => ({
    credentials: session.credentials,
    status: session.status,
    authenticate,
    clearCredentials,
  }), [authenticate, clearCredentials, session]);
}

async function restoreAuthSession(credentials: Credentials): Promise<Credentials> {
  try {
    await validateCredentials(credentials);
    return credentials;
  } catch (error) {
    if (isInvalidSessionError(error)) removeStoredCredentials();
    throw error;
  }
}

async function authenticateAuthSession(credentials: Credentials): Promise<void> {
  await validateCredentials(credentials);
  writeStoredCredentials(credentials);
}

function clearAuthSession(): void {
  removeStoredCredentials();
}

function isInvalidSessionError(error: unknown): boolean {
  return error instanceof ApiError && [401, 403].includes(error.status);
}
