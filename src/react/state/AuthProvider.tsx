import { useState, type ReactNode } from 'react';

import { createFeatureComposition, type FeatureUseCases } from '../application/featureComposition';
import { useAuthSession } from './authSession';
import { AuthContext } from './authContext';
import { FeatureUseCasesContext } from './featureUseCasesContext';

export function AuthProvider({
  children,
  useCases,
}: {
  children: ReactNode;
  useCases?: FeatureUseCases;
}) {
  const [featureUseCases] = useState(() => useCases ?? createFeatureComposition());
  const session = useAuthSession(featureUseCases.auth);

  return (
    <FeatureUseCasesContext value={featureUseCases}>
      <AuthContext value={session}>{children}</AuthContext>
    </FeatureUseCasesContext>
  );
}
