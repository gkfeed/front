import type { ReactNode } from 'react';

import { useAuthSession } from './authSession';
import { AuthContext } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useAuthSession();

  return <AuthContext value={session}>{children}</AuthContext>;
}
