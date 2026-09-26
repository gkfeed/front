import { createContext } from 'react';

import type { Credentials } from '../types';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'restore-error';

export interface AuthContextValue {
  credentials: Credentials | null;
  status: AuthStatus;
  authenticate: (credentials: Credentials) => Promise<void>;
  retryRestore: () => Promise<boolean>;
  clearCredentials: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
