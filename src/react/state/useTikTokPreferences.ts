import { use } from 'react';

import { TikTokPreferencesContext } from './tiktokPreferencesContext';

export function useTikTokPreferences() {
  return use(TikTokPreferencesContext);
}
