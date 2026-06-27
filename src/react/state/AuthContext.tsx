import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Credentials } from '../types';

interface AuthContextValue {
  credentials: Credentials | null;
  saveCredentials: (credentials: Credentials) => void;
  clearCredentials: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    credentials,
    saveCredentials: setCredentials,
    clearCredentials: () => setCredentials(null),
  }), [credentials]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
