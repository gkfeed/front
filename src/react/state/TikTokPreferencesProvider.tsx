import { useCallback, useContext, useMemo, type ReactNode } from 'react';

import { PluginSettingsProvider } from './PluginSettingsProvider';
import { PluginSettingsContext } from './pluginSettingsContext';
import { TikTokPreferencesContext } from './tiktokPreferencesContext';

export const TIKTOK_PLAYBACK_MODE_STORAGE_KEY = 'gkfeed.tiktokPlaybackMode';
export const HIDE_TIKTOK_ITEMS_STORAGE_KEY = 'gkfeed.hideTikTokItems';
export const TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY = 'gkfeed.pluginSettings.tiktok.v1';

/** Compatibility facade for existing player/filter consumers. */
export function TikTokPreferencesProvider({ children }: { children: ReactNode }) {
  return <PluginSettingsProvider><TikTokPreferencesBridge>{children}</TikTokPreferencesBridge></PluginSettingsProvider>;
}

function TikTokPreferencesBridge({ children }: { children: ReactNode }) {
  const { values, setValue } = useContext(PluginSettingsContext);
  const setPlaybackMode = useCallback((mode: 'embed' | 'preview') => setValue('tiktok', 'playbackMode', mode), [setValue]);
  const setHideTikTokItems = useCallback((hide: boolean) => setValue('tiktok', 'hideItems', hide), [setValue]);
  const value = useMemo(() => ({
    playbackMode: values.tiktok?.playbackMode === 'preview' ? 'preview' as const : 'embed' as const,
    hideTikTokItems: values.tiktok?.hideItems === true,
    setPlaybackMode,
    setHideTikTokItems,
  }), [values, setPlaybackMode, setHideTikTokItems]);
  return <TikTokPreferencesContext value={value}>{children}</TikTokPreferencesContext>;
}
