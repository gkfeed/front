import type { ReactNode } from 'react';

import type { FeatureUseCases } from '../application/featureComposition';
import { AuthProvider } from './AuthProvider';
import { FeatureUseCasesProvider } from './FeatureUseCasesProvider';

export function AppProviders({
  children,
  useCases,
}: {
  children: ReactNode;
  useCases?: FeatureUseCases;
}) {
  return (
    <FeatureUseCasesProvider useCases={useCases}>
      <AuthProvider>{children}</AuthProvider>
    </FeatureUseCasesProvider>
  );
}
