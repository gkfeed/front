import { createContext } from 'react';

import type { FeedPluginId } from '../domain/feedItemProviderPresentation';

export type PluginPreferencesValue = {
  disabledPlugins: ReadonlySet<FeedPluginId>;
  isPluginEnabled: (pluginId: FeedPluginId) => boolean;
  setPluginEnabled: (pluginId: FeedPluginId, enabled: boolean) => void;
  enableAllPlugins: () => void;
};

export const PluginPreferencesContext = createContext<PluginPreferencesValue>({
  disabledPlugins: new Set(),
  isPluginEnabled: () => true,
  setPluginEnabled: () => {},
  enableAllPlugins: () => {},
});
