import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { TikTokPreferencesContext } from './tiktokPreferencesContext';

export const TIKTOK_PLAYBACK_MODE_STORAGE_KEY = 'gkfeed.tiktokPlaybackMode';

export const HIDE_TIKTOK_ITEMS_STORAGE_KEY = 'gkfeed.hideTikTokItems';

export function TikTokPreferencesProvider({ children }: { children: ReactNode }) {
  const [playbackMode, setPlaybackModeState] = useState<'embed' | 'preview'>(() => {
    try {
      return window.localStorage.getItem(TIKTOK_PLAYBACK_MODE_STORAGE_KEY) === 'preview' ? 'preview' : 'embed';
    } catch {
      return 'embed';
    }
  });
  const setPlaybackMode = useCallback((mode: 'embed' | 'preview') => {
    setPlaybackModeState(mode);
    try {
      window.localStorage.setItem(TIKTOK_PLAYBACK_MODE_STORAGE_KEY, mode);
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);
  const [hideTikTokItems, setHideTikTokItemsState] = useState(readHideTikTokItemsPreference);

  const setHideTikTokItems = useCallback((hide: boolean) => {
    setHideTikTokItemsState(hide);
    try {
      window.localStorage.setItem(HIDE_TIKTOK_ITEMS_STORAGE_KEY, String(hide));
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
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
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(HIDE_TIKTOK_ITEMS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
