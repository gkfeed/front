import { createContext } from 'react';

export type NsfwMode = 'show' | 'blur' | 'hide';

export type NsfwPreferencesValue = {
  nsfwMode: NsfwMode;
  setNsfwMode: (mode: NsfwMode) => void;
};

export const NsfwPreferencesContext = createContext<NsfwPreferencesValue>({
  nsfwMode: 'blur',
  setNsfwMode: () => undefined,
});
