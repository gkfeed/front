import { createContext } from 'react';

export type TikTokPreferencesValue = {
  hideTikTokItems: boolean;
  setHideTikTokItems: (hide: boolean) => void;
};

export const TikTokPreferencesContext = createContext<TikTokPreferencesValue>({
  hideTikTokItems: false,
  setHideTikTokItems: () => undefined,
});
