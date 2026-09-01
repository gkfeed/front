import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  changeFeedPriority,
  FEED_PRIORITIES_STORAGE_KEY,
  parseFeedPriorities,
  type FeedPriorities,
} from './feedPriority';
import { FeedPriorityContext } from './feedPriorityContext';

export function FeedPriorityProvider({ children }: { children: ReactNode }) {
  const [priorities, setPriorities] = useState(readFeedPriorities);

  const changePriority = useCallback((feedId: number, delta: -1 | 1) => {
    setPriorities((current) => {
      const next = changeFeedPriority(current, feedId, delta);
      writeFeedPriorities(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ priorities, changePriority }), [changePriority, priorities]);
  return <FeedPriorityContext value={value}>{children}</FeedPriorityContext>;
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
