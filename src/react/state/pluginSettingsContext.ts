import { createContext } from 'react';

import { feedPluginCatalog, type FeedPluginId } from '../domain/feedItemProviderPresentation';
import { validatePluginSettings, type PluginSettingsValues } from '../domain/feedPluginSettings';

export type PluginSettingsContextValue = {
  values: Readonly<Partial<Record<FeedPluginId, PluginSettingsValues>>>;
  setValue: (pluginId: FeedPluginId, fieldId: string, value: string | boolean) => void;
};

export const PluginSettingsContext = createContext<PluginSettingsContextValue>({
  values: Object.fromEntries(feedPluginCatalog.map((plugin) => [plugin.id, validatePluginSettings(plugin.settings ?? [], {})])),
  setValue: () => {},
});
