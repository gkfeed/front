import { createContext } from 'react';

import type { FeatureUseCases } from '../application/featureComposition';

export const FeatureUseCasesContext = createContext<FeatureUseCases | null>(null);
