import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, validateCredentials } from '../services/feeds';
import type { Credentials } from '../types';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import {
  readStoredCredentials,
  removeStoredCredentials,
  writeStoredCredentials,
} from './authStorage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedCredentials] = useState(readStoredCredentials);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [status, setStatus] = useState<AuthStatus>(storedCredentials ? 'checking' : 'anonymous');

  useEffect(() => {
    if (!storedCredentials) return;

    let active = true;
    validateCredentials(storedCredentials).then(() => {
      if (!active) return;
      setCredentials(storedCredentials);
      setStatus('authenticated');
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) removeStoredCredentials();
      setStatus('anonymous');
    });

    return () => {
      active = false;
    };
  }, [storedCredentials]);

  const authenticate = useCallback(async (nextCredentials: Credentials) => {
    await validateCredentials(nextCredentials);
    setCredentials(nextCredentials);
    setStatus('authenticated');
    writeStoredCredentials(nextCredentials);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(null);
    setStatus('anonymous');
    removeStoredCredentials();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    credentials,
    status,
    authenticate,
    clearCredentials,
  }), [authenticate, clearCredentials, credentials, status]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
