import { createContext } from 'react';

import type { NsfwMode } from '../domain/feedItemCardContracts';

export type { NsfwMode } from '../domain/feedItemCardContracts';

export type NsfwPreferencesValue = {
  nsfwMode: NsfwMode;
  setNsfwMode: (mode: NsfwMode) => void;
};

export const NsfwPreferencesContext = createContext<NsfwPreferencesValue>({
  nsfwMode: 'blur',
  setNsfwMode: () => undefined,
});
