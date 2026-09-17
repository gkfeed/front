import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from './useAuth';
import {
  changeFeedPriority,
  FEED_PRIORITIES_STORAGE_KEY,
  getEffectiveFeedPriorities,
  parseFeedPriorities,
  type FeedPriorities,
} from './feedPriority';
import { FeedPriorityContext } from './feedPriorityContext';
import { useFeedDecisions } from './useFeedDecisions';

export const FEED_PRIORITIZATION_ENABLED_STORAGE_KEY = 'gkfeed.feedPrioritizationEnabled.v1';

export function FeedPriorityProvider({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const username = credentials?.username ?? null;
  const [isEnabled, setEnabledState] = useState(readFeedPrioritizationEnabled);
  const [priorities, setPriorities] = useState(readFeedPriorities);
  const { decisions, recordDecision } = useFeedDecisions(username);

  const setEnabled = useCallback((nextIsEnabled: boolean) => {
    setEnabledState(nextIsEnabled);
    try {
      window.localStorage.setItem(
        FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
        String(nextIsEnabled),
      );
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);

  const changePriority = useCallback((feedId: number, delta: -1 | 1) => {
    setPriorities((current) => {
      const next = changeFeedPriority(current, feedId, delta);
      writeFeedPriorities(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    isEnabled,
    priorities,
    effectivePriorities: isEnabled ? getEffectiveFeedPriorities(priorities, decisions) : {},
    changePriority,
    recordDecision,
    setEnabled,
  }), [
    changePriority,
    decisions,
    isEnabled,
    priorities,
    recordDecision,
    setEnabled,
  ]);
  return <FeedPriorityContext value={value}>{children}</FeedPriorityContext>;
}

function readFeedPrioritizationEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
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
