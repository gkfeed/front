import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthUseCases } from '../features/auth/authUseCaseFactory';
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

export function useAuthSession(authUseCases: AuthUseCases): AuthContextValue {
  const [storedCredentials] = useState(readStoredCredentials);
  const restorableCredentials = useRef(storedCredentials);
  const sessionAttemptId = useRef(0);
  const isMounted = useRef(false);
  const [session, setSession] = useState<AuthSessionState>(() => ({
    credentials: null,
    status: storedCredentials ? 'checking' : 'anonymous',
  }));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      sessionAttemptId.current += 1;
    };
  }, []);

  const retryRestore = useCallback(async (): Promise<boolean> => {
    const saved = restorableCredentials.current;
    if (!saved) return false;
    const attempt = ++sessionAttemptId.current;
    setSession({ credentials: null, status: 'checking' });
    try {
      const credentials = await authUseCases.restoreAuthentication(saved, () => {
        if (isMounted.current && sessionAttemptId.current === attempt) removeStoredCredentials();
      });
      if (!isMounted.current || sessionAttemptId.current !== attempt) return false;
      setSession({ credentials, status: 'authenticated' });
      return true;
    } catch (error) {
      if (!isMounted.current || sessionAttemptId.current !== attempt) return false;
      const invalidCredentials = authUseCases.isAuthenticationError(error);
      if (invalidCredentials) restorableCredentials.current = null;
      setSession({
        credentials: null,
        status: invalidCredentials ? 'anonymous' : 'restore-error',
      });
      return false;
    }
  }, [authUseCases]);

  useEffect(() => {
    if (storedCredentials) void retryRestore();
  }, [retryRestore, storedCredentials]);

  const authenticate = useCallback(async (credentials: Credentials) => {
    const attempt = ++sessionAttemptId.current;
    const requireCurrentAttempt = () => {
      if (!isMounted.current || sessionAttemptId.current !== attempt) {
        throw new DOMException('Authentication attempt superseded', 'AbortError');
      }
    };
    await authUseCases.authenticateCredentials(credentials, (validatedCredentials) => {
      requireCurrentAttempt();
      writeStoredCredentials(validatedCredentials);
    });
    requireCurrentAttempt();
    restorableCredentials.current = null;
    setSession({ credentials, status: 'authenticated' });
  }, [authUseCases]);

  const clearCredentials = useCallback(() => {
    sessionAttemptId.current += 1;
    restorableCredentials.current = null;
    removeStoredCredentials();
    setSession({ credentials: null, status: 'anonymous' });
  }, []);

  return useMemo(() => ({
    credentials: session.credentials,
    status: session.status,
    authenticate,
    retryRestore,
    clearCredentials,
  }), [authenticate, clearCredentials, retryRestore, session]);
}
