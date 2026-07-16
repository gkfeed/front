import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ApiError, validateCredentials } from '../services/feeds';
import type { Credentials } from '../types';
import { getObjectProperty } from '../unknownObject';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';

const STORAGE_KEY = 'gkfeed.credentials';

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

function readStoredCredentials(): Credentials | null {
  const storage = getCredentialStorage();
  if (!storage) return null;

  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isCredentials(value: unknown): value is Credentials {
  const username = getObjectProperty(value, 'username');
  const password = getObjectProperty(value, 'password');

  return typeof username === 'string' && typeof password === 'string';
}

function writeStoredCredentials(credentials: Credentials) {
  const storage = getCredentialStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Keep the in-memory login usable if storage is unavailable.
  }
}

function removeStoredCredentials() {
  const storage = getCredentialStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover; the in-memory state has already been cleared.
  }
}

function getCredentialStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
