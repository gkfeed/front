import { useContext, useState } from 'react';

import {
  createFeatureComposition,
  type FeatureUseCases,
} from '../application/featureComposition';
import { FeatureUseCasesContext } from './featureUseCasesContext';

export function useFeatureUseCases(): FeatureUseCases {
  const value = useContext(FeatureUseCasesContext);
  const [fallback] = useState(createFeatureComposition);
  return value ?? fallback;
}
