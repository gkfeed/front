import { createContext } from 'react';

import type { Credentials } from '../types';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  credentials: Credentials | null;
  status: AuthStatus;
  authenticate: (credentials: Credentials) => Promise<void>;
  clearCredentials: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
