export type ReaderMode = 'review' | 'scroll';

export const READER_MODE_STORAGE_KEY = 'gkfeed.readerMode';

export function getReaderMode(search: string): ReaderMode {
  const queryMode = new URLSearchParams(search).get('view');
  if (queryMode === 'scroll' || queryMode === 'review') return queryMode;
  return readReaderModePreference();
}

export function readReaderModePreference(): ReaderMode {
  if (typeof window === 'undefined') return 'review';

  try {
    return window.localStorage.getItem(READER_MODE_STORAGE_KEY) === 'scroll' ? 'scroll' : 'review';
  } catch {
    return 'review';
  }
}

export function saveReaderModePreference(mode: ReaderMode): void {
  try {
    window.localStorage.setItem(READER_MODE_STORAGE_KEY, mode);
  } catch {
    // Keep the current settings page usable when storage is unavailable.
  }
}
