import { useCallback, useEffect, useState } from 'react';

import { parseFeedDecisions, recordFeedDecision, type FeedDecision } from './feedDecisions';

export function getFeedDecisionsStorageKey(username: string): string {
  return `gkfeed.feedDecisions.v1:${encodeURIComponent(username)}`;
}

export function useFeedDecisions(username: string | null) {
  const storageKey = username ? getFeedDecisionsStorageKey(username) : null;
  const [state, setState] = useState(() => ({
    storageKey,
    decisions: readDecisions(storageKey) ?? [],
    pending: [] as readonly FeedDecision[],
  }));
  if (state.storageKey !== storageKey) {
    setState({ storageKey, decisions: readDecisions(storageKey) ?? [], pending: [] });
  }

  useEffect(() => {
    if (!state.storageKey || state.pending.length === 0) return;
    const decisions = state.pending.reduce(recordFeedDecision, readDecisions(state.storageKey) ?? state.decisions);
    try {
      window.localStorage.setItem(state.storageKey, JSON.stringify(decisions));
      setState((current) => current === state ? { ...current, decisions, pending: [] } : current);
    } catch {
      return;
    }
  }, [state]);

  const recordDecision = useCallback((decision: FeedDecision) => {
    if (!storageKey) return;
    setState((current) => {
      if (current.storageKey !== storageKey) return current;
      const decisions = recordFeedDecision(current.decisions, decision);
      return decisions === current.decisions ? current : {
        storageKey,
        decisions,
        pending: recordFeedDecision(current.pending, decision),
      };
    });
  }, [storageKey]);

  return { decisions: state.decisions, recordDecision };
}

function readDecisions(storageKey: string | null): readonly FeedDecision[] | null {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? parseFeedDecisions(JSON.parse(saved)) : [];
  } catch {
    return null;
  }
}
