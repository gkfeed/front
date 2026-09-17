import { useCallback, useEffect, useState } from 'react';

import { parseFeedDecisions, recordFeedDecision, type FeedDecision } from './feedPriority';

export function getFeedDecisionsStorageKey(username: string): string {
  return `gkfeed.feedDecisions.v1:${encodeURIComponent(username)}`;
}

export function useFeedDecisions(username: string | null) {
  const storageKey = username ? getFeedDecisionsStorageKey(username) : null;
  const [state, setState] = useState(() => ({ storageKey, decisions: readDecisions(storageKey) }));
  if (state.storageKey !== storageKey) {
    setState({ storageKey, decisions: readDecisions(storageKey) });
  }

  useEffect(() => {
    if (!storageKey || state.storageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.decisions));
    } catch {
      return;
    }
  }, [state, storageKey]);

  const recordDecision = useCallback((decision: FeedDecision) => {
    if (!storageKey) return;
    setState((current) => {
      if (current.storageKey !== storageKey) return current;
      const decisions = recordFeedDecision(current.decisions, decision);
      return decisions === current.decisions ? current : { storageKey, decisions };
    });
  }, [storageKey]);

  return { decisions: state.decisions, recordDecision };
}

function readDecisions(storageKey: string | null): readonly FeedDecision[] {
  if (!storageKey || typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? parseFeedDecisions(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}
