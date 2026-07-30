import { createContext } from 'react';

export type NsfwPreferencesValue = {
  blurNsfw: boolean;
  setBlurNsfw: (blurNsfw: boolean) => void;
};

export const NsfwPreferencesContext = createContext<NsfwPreferencesValue>({
  blurNsfw: true,
  setBlurNsfw: () => undefined,
});
