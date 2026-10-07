import { useContext } from 'react';

import type { FeedPluginId } from '../domain/feedItemProviderPresentation';
import { PluginSettingsContext } from './pluginSettingsContext';

export function usePluginSettings(pluginId: FeedPluginId) {
  const { values, setValue } = useContext(PluginSettingsContext);
  return {
    values: values[pluginId] ?? {},
    setValue: (fieldId: string, value: string | boolean) => setValue(pluginId, fieldId, value),
  };
}
