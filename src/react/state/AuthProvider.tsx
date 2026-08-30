import type { ReactNode } from 'react';

import { useAuthSession } from './authSession';
import { AuthContext } from './authContext';
import { useFeatureUseCases } from './useFeatureUseCases';

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { auth } = useFeatureUseCases();
  const session = useAuthSession(auth);

  return (
    <AuthContext value={session}>{children}</AuthContext>
  );
}
