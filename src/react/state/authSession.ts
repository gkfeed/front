import { useCallback, useEffect, useMemo, useState } from 'react';

import { validateCredentials } from '../services/auth';
import { isAuthenticationError } from '../services/authError';
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
    await validateCredentials(credentials);
    writeStoredCredentials(credentials);
    setSession({ credentials, status: 'authenticated' });
  }, []);

  const clearCredentials = useCallback(() => {
    removeStoredCredentials();
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
  } catch (error) {
    if (isInvalidSessionError(error)) removeStoredCredentials();
    throw error;
  }
  return credentials;
}

function isInvalidSessionError(error: unknown): boolean {
  return isAuthenticationError(error);
}
