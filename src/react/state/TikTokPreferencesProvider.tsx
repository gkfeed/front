import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { TikTokPreferencesContext } from './tiktokPreferencesContext';

export const TIKTOK_PLAYBACK_MODE_STORAGE_KEY = 'gkfeed.tiktokPlaybackMode';

export const HIDE_TIKTOK_ITEMS_STORAGE_KEY = 'gkfeed.hideTikTokItems';
export const TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY = 'gkfeed.pluginSettings.tiktok.v1';

type TikTokPluginSettings = {
  playbackMode: 'embed' | 'preview';
  hideItems: boolean;
};

export function TikTokPreferencesProvider({ children }: { children: ReactNode }) {
  const [playbackMode, setPlaybackModeState] = useState<'embed' | 'preview'>(() => {
    return readTikTokPluginSettings().playbackMode;
  });
  const setPlaybackMode = useCallback((mode: 'embed' | 'preview') => {
    setPlaybackModeState(mode);
    writeTikTokPluginSettings({ ...readTikTokPluginSettings(), playbackMode: mode });
  }, []);
  const [hideTikTokItems, setHideTikTokItemsState] = useState(readHideTikTokItemsPreference);

  const setHideTikTokItems = useCallback((hide: boolean) => {
    setHideTikTokItemsState(hide);
    writeTikTokPluginSettings({ ...readTikTokPluginSettings(), hideItems: hide });
  }, []);

  const value = useMemo(() => ({
    playbackMode,
    setPlaybackMode,
    hideTikTokItems,
    setHideTikTokItems,
  }), [playbackMode, setPlaybackMode, hideTikTokItems, setHideTikTokItems]);

  return <TikTokPreferencesContext value={value}>{children}</TikTokPreferencesContext>;
}

function readHideTikTokItemsPreference(): boolean {
  return readTikTokPluginSettings().hideItems;
}

function readTikTokPluginSettings(): TikTokPluginSettings {
  if (typeof window === 'undefined') return { playbackMode: 'embed', hideItems: false };

  try {
    const stored = window.localStorage.getItem(TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        const settings = parsed as Partial<TikTokPluginSettings>;
        return {
          playbackMode: settings.playbackMode === 'preview' ? 'preview' : 'embed',
          hideItems: settings.hideItems === true,
        };
      }
    }
    const migrated = {
      playbackMode: window.localStorage.getItem(TIKTOK_PLAYBACK_MODE_STORAGE_KEY) === 'preview'
        ? 'preview' as const : 'embed' as const,
      hideItems: window.localStorage.getItem(HIDE_TIKTOK_ITEMS_STORAGE_KEY) === 'true',
    };
    writeTikTokPluginSettings(migrated);
    return migrated;
  } catch {
    return { playbackMode: 'embed', hideItems: false };
  }
}

function writeTikTokPluginSettings(settings: TikTokPluginSettings): void {
  try {
    window.localStorage.setItem(TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    window.localStorage.removeItem(TIKTOK_PLAYBACK_MODE_STORAGE_KEY);
    window.localStorage.removeItem(HIDE_TIKTOK_ITEMS_STORAGE_KEY);
  } catch {
    // Keep the in-memory preference usable when storage is unavailable.
  }
}
