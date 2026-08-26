import type { TikTokPreviewMode } from '../domain/tiktokPreview';

export type { TikTokPreviewMode } from '../domain/tiktokPreview';

export const TIKTOK_PREVIEW_MODE_STORAGE_KEY = 'gkfeed.tiktokPreviewMode';

export function readTikTokPreviewMode(): TikTokPreviewMode {
  if (typeof window === 'undefined') return 'embed';

  try {
    return window.localStorage.getItem(TIKTOK_PREVIEW_MODE_STORAGE_KEY) === 'broker'
      ? 'broker'
      : 'embed';
  } catch {
    return 'embed';
  }
}
