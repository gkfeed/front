import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  NsfwPreferencesContext,
  type NsfwMode,
} from './nsfwPreferencesContext';

export const NSFW_MODE_STORAGE_KEY = 'gkfeed.nsfwMode';
const LEGACY_NSFW_BLUR_STORAGE_KEY = 'gkfeed.blurNsfw';

export function NsfwPreferencesProvider({ children }: { children: ReactNode }) {
  const [nsfwMode, setNsfwModeState] = useState(readNsfwModePreference);

  const setNsfwMode = useCallback((nextMode: NsfwMode) => {
    setNsfwModeState(nextMode);
    try {
      window.localStorage.setItem(NSFW_MODE_STORAGE_KEY, nextMode);
      window.localStorage.removeItem(LEGACY_NSFW_BLUR_STORAGE_KEY);
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({
    nsfwMode,
    setNsfwMode,
  }), [nsfwMode, setNsfwMode]);

  return <NsfwPreferencesContext value={value}>{children}</NsfwPreferencesContext>;
}

function readNsfwModePreference(): NsfwMode {
  if (typeof window === 'undefined') return 'blur';

  try {
    const savedMode = window.localStorage.getItem(NSFW_MODE_STORAGE_KEY);
    if (savedMode === 'show' || savedMode === 'blur' || savedMode === 'hide') return savedMode;
    return window.localStorage.getItem(LEGACY_NSFW_BLUR_STORAGE_KEY) === 'false' ? 'show' : 'blur';
  } catch {
    return 'blur';
  }
}
