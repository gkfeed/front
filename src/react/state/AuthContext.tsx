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
    saveCredentials(nextCredentials) {
      setCredentials(nextCredentials);
    },
    clearCredentials() {
      setCredentials(null);
    },
  }), [credentials]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
