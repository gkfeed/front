import { useSyncExternalStore } from 'react';

export type ReaderMode = 'review' | 'scroll';

export const READER_MODE_STORAGE_KEY = 'gkfeed.readerMode.v1';
const CHANGE_EVENT = 'gkfeed-reader-mode-change';
let inMemoryMode: ReaderMode = 'review';
let hasUnpersistedMode = false;

export function getReaderMode(search: string, defaultMode = readDefaultReaderMode()): ReaderMode {
  const value = new URLSearchParams(search).get('view');
  if (value === 'scroll' || value === 'review') return value;
  return defaultMode;
}

export function readDefaultReaderMode(): ReaderMode {
  if (typeof window === 'undefined') return 'review';
  if (hasUnpersistedMode) return inMemoryMode;
  try {
    inMemoryMode = window.localStorage.getItem(READER_MODE_STORAGE_KEY) === 'scroll' ? 'scroll' : 'review';
    return inMemoryMode;
  } catch {
    return inMemoryMode;
  }
}

export function setDefaultReaderMode(mode: ReaderMode): void {
  inMemoryMode = mode;
  hasUnpersistedMode = true;
  try {
    window.localStorage.setItem(READER_MODE_STORAGE_KEY, mode);
    hasUnpersistedMode = false;
  } catch {
    // Keep the default usable in this tab when storage is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === READER_MODE_STORAGE_KEY || event.key === null) {
      hasUnpersistedMode = false;
      listener();
    }
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useDefaultReaderMode(): ReaderMode {
  return useSyncExternalStore(subscribe, readDefaultReaderMode, () => 'review');
}
