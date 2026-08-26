import { use } from 'react';

import { TikTokPreviewPreferencesContext } from './tiktokPreviewPreferencesContext';

export function useTikTokPreviewPreferences() {
  return use(TikTokPreviewPreferencesContext);
}
