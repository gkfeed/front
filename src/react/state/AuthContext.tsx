import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Credentials } from '../types';
import { getObjectProperty } from '../unknownObject';

interface AuthContextValue {
  credentials: Credentials | null;
  saveCredentials: (credentials: Credentials) => void;
  clearCredentials: () => void;
}

const STORAGE_KEY = 'gkfeed.credentials';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(readStoredCredentials);

  const saveCredentials = useCallback((nextCredentials: Credentials) => {
    setCredentials(nextCredentials);
    writeStoredCredentials(nextCredentials);
  }, []);

  const clearCredentials = useCallback(() => {
    setCredentials(null);
    removeStoredCredentials();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    credentials,
    saveCredentials,
    clearCredentials,
  }), [clearCredentials, credentials, saveCredentials]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
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
