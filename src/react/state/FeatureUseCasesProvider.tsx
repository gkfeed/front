import { useState, type ReactNode } from 'react';

import {
  createFeatureComposition,
  type FeatureUseCases,
} from '../application/featureComposition';
import { FeatureUseCasesContext } from './featureUseCasesContext';

export function FeatureUseCasesProvider({
  children,
  useCases,
}: {
  children: ReactNode;
  useCases?: FeatureUseCases;
}) {
  const [value] = useState(() => useCases ?? createFeatureComposition());

  return (
    <FeatureUseCasesContext value={value}>
      {children}
    </FeatureUseCasesContext>
  );
}
