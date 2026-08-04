import { useCallback, useEffect, useMemo, useState } from 'react';

import { featureUseCases } from '../application/featureComposition';
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

const authUseCases = featureUseCases.auth;

export function useAuthSession(): AuthContextValue {
  const [storedCredentials] = useState(readStoredCredentials);
  const [session, setSession] = useState<AuthSessionState>(() => ({
    credentials: null,
    status: storedCredentials ? 'checking' : 'anonymous',
  }));

  useEffect(() => {
    if (!storedCredentials) return;

    let active = true;
    authUseCases.restoreAuthentication(storedCredentials, removeStoredCredentials).then((credentials) => {
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
    await authUseCases.authenticateCredentials(credentials, writeStoredCredentials);
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
