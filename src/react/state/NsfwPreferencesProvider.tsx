import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { NsfwPreferencesContext } from './nsfwPreferencesContext';

export const NSFW_BLUR_STORAGE_KEY = 'gkfeed.blurNsfw';

export function NsfwPreferencesProvider({ children }: { children: ReactNode }) {
  const [blurNsfw, setBlurNsfwState] = useState(readBlurNsfwPreference);

  const setBlurNsfw = useCallback((nextBlurNsfw: boolean) => {
    setBlurNsfwState(nextBlurNsfw);
    try {
      window.localStorage.setItem(NSFW_BLUR_STORAGE_KEY, String(nextBlurNsfw));
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({
    blurNsfw,
    setBlurNsfw,
  }), [blurNsfw, setBlurNsfw]);

  return <NsfwPreferencesContext value={value}>{children}</NsfwPreferencesContext>;
}

function readBlurNsfwPreference(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(NSFW_BLUR_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}
