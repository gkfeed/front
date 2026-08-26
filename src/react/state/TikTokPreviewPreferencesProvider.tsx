import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  readTikTokPreviewMode,
  TIKTOK_PREVIEW_MODE_STORAGE_KEY,
  type TikTokPreviewMode,
} from './tiktokPreviewPreferences';
import { TikTokPreviewPreferencesContext } from './tiktokPreviewPreferencesContext';

export function TikTokPreviewPreferencesProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState(readTikTokPreviewMode);

  const setMode = useCallback((nextMode: TikTokPreviewMode) => {
    setModeState(nextMode);
    try {
      window.localStorage.setItem(TIKTOK_PREVIEW_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <TikTokPreviewPreferencesContext value={value}>
      {children}
    </TikTokPreviewPreferencesContext>
  );
}
