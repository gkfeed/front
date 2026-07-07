import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Credentials } from '../types';

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
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<Credentials>;
    return typeof parsed.username === 'string' && typeof parsed.password === 'string'
      ? { username: parsed.username, password: parsed.password }
      : null;
  } catch {
    return null;
  }
}

function writeStoredCredentials(credentials: Credentials) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Keep the in-memory login usable if storage is unavailable.
  }
}

function removeStoredCredentials() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover; the in-memory state has already been cleared.
  }
}
