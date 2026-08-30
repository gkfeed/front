import { useContext, useMemo } from 'react';

import {
  createFeatureComposition,
  type FeatureUseCases,
} from '../application/featureComposition';
import { FeatureUseCasesContext } from './featureUseCasesContext';

export function useFeatureUseCases(): FeatureUseCases {
  const value = useContext(FeatureUseCasesContext);
  return useMemo(() => value ?? createFeatureComposition(), [value]);
}
