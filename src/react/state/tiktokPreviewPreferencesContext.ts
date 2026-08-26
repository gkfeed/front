import { createContext } from 'react';

import type { TikTokPreviewMode } from './tiktokPreviewPreferences';

export type TikTokPreviewPreferencesValue = {
  mode: TikTokPreviewMode;
  setMode: (mode: TikTokPreviewMode) => void;
};

export const TikTokPreviewPreferencesContext = createContext<TikTokPreviewPreferencesValue>({
  mode: 'embed',
  setMode: () => undefined,
});
