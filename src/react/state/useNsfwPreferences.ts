import { use } from 'react';

import { NsfwPreferencesContext } from './nsfwPreferencesContext';

export function useNsfwPreferences() {
  return use(NsfwPreferencesContext);
}
