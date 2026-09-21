export type ReaderMode = 'review' | 'scroll';

export const READER_MODE_STORAGE_KEY = 'gkfeed.readerMode.v1';

export function getReaderMode(search: string): ReaderMode {
  const value = new URLSearchParams(search).get('view');
  if (value === 'scroll' || value === 'review') return value;
  return readDefaultReaderMode();
}

export function readDefaultReaderMode(): ReaderMode {
  if (typeof window === 'undefined') return 'review';
  try {
    return window.localStorage.getItem(READER_MODE_STORAGE_KEY) === 'scroll' ? 'scroll' : 'review';
  } catch {
    return 'review';
  }
}

export function setDefaultReaderMode(mode: ReaderMode): void {
  try {
    window.localStorage.setItem(READER_MODE_STORAGE_KEY, mode);
  } catch {
    // Keep the default usable for the current render when storage is unavailable.
  }
}
