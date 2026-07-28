import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'gkfeed:tiktok-comments-expanded';
const CHANGE_EVENT = 'gkfeed:tiktok-comments-preference-change';
let memoryValue = false;

export function useTikTokCommentsPreference(): [boolean, (expanded: boolean) => void] {
  const isExpanded = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setIsExpanded = useCallback((expanded: boolean) => {
    memoryValue = expanded;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(expanded));
    } catch {
      // The in-memory value still keeps cards synchronized when storage is unavailable.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [isExpanded, setIsExpanded];
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function getSnapshot(): boolean {
  try {
    const storedValue = window.sessionStorage.getItem(STORAGE_KEY);
    return storedValue === 'true';
  } catch {
    // Fall back to memory when session storage is blocked.
  }
  return memoryValue;
}
