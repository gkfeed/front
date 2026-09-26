import { use } from 'react';

import { PluginPreferencesContext } from './pluginPreferencesContext';

export function usePluginPreferences() {
  return use(PluginPreferencesContext);
}
