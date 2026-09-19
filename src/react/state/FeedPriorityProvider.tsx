import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  changeFeedPriority,
  FEED_PRIORITIES_STORAGE_KEY,
  parseFeedPriorities,
  type FeedPriorities,
} from './feedPriority';
import { FeedPriorityContext } from './feedPriorityContext';

export const FEED_PRIORITIZATION_ENABLED_STORAGE_KEY = 'gkfeed.feedPrioritizationEnabled.v1';
export const MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY = 'gkfeed.manualFeedPrioritizationEnabled.v1';
export const AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY = 'gkfeed.automaticFeedPrioritizationEnabled.v1';

export function FeedPriorityProvider({ children }: { children: ReactNode }) {
  const [isManualEnabled, setManualEnabledState] = useState(
    () => readFeedPrioritizationEnabled(MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY),
  );
  const [isAutomaticEnabled, setAutomaticEnabledState] = useState(
    () => readFeedPrioritizationEnabled(AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY),
  );
  const [priorities, setPriorities] = useState(readFeedPriorities);

  const setManualEnabled = usePersistedEnabledState(
    setManualEnabledState,
    MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
  );
  const setAutomaticEnabled = usePersistedEnabledState(
    setAutomaticEnabledState,
    AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
  );

  const changePriority = useCallback((feedId: number, delta: -1 | 1) => {
    setPriorities((current) => {
      const next = changeFeedPriority(current, feedId, delta);
      writeFeedPriorities(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    isManualEnabled,
    isAutomaticEnabled,
    priorities,
    changePriority,
    setManualEnabled,
    setAutomaticEnabled,
  }), [
    changePriority,
    isAutomaticEnabled,
    isManualEnabled,
    priorities,
    setAutomaticEnabled,
    setManualEnabled,
  ]);
  return <FeedPriorityContext value={value}>{children}</FeedPriorityContext>;
}

function usePersistedEnabledState(
  setState: (isEnabled: boolean) => void,
  storageKey: string,
) {
  return useCallback((isEnabled: boolean) => {
    setState(isEnabled);
    try {
      window.localStorage.setItem(storageKey, String(isEnabled));
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, [setState, storageKey]);
}

function readFeedPrioritizationEnabled(storageKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved !== null) return saved !== 'false';

    // Apply the former shared preference until the user chooses separate values.
    return window.localStorage.getItem(FEED_PRIORITIZATION_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function readFeedPriorities(): FeedPriorities {
  if (typeof window === 'undefined') return {};
  try {
    const saved = window.localStorage.getItem(FEED_PRIORITIES_STORAGE_KEY);
    return saved ? parseFeedPriorities(JSON.parse(saved)) : {};
  } catch {
    return {};
  }
}

function writeFeedPriorities(priorities: FeedPriorities): void {
  try {
    window.localStorage.setItem(FEED_PRIORITIES_STORAGE_KEY, JSON.stringify(priorities));
  } catch {
    // Keep priorities usable for this session when storage is unavailable.
  }
}
