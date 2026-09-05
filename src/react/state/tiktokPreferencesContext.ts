import { createContext } from 'react';

export type TikTokPreferencesValue = {
  playbackMode: 'embed' | 'preview';
  setPlaybackMode: (mode: 'embed' | 'preview') => void;
  hideTikTokItems: boolean;
  setHideTikTokItems: (hide: boolean) => void;
};

export const TikTokPreferencesContext = createContext<TikTokPreferencesValue>({
  playbackMode: 'embed',
  setPlaybackMode: () => undefined,
  hideTikTokItems: false,
  setHideTikTokItems: () => undefined,
});
