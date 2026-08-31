import { useCallback, useEffect, useState } from 'react';

import type { Credentials, FeedItem } from '../types';
import { useFeatureUseCases } from '../state/useFeatureUseCases';

type FeedItemsState = {
  loadedItems: FeedItem[] | undefined;
  status: 'loading' | 'success' | 'error';
  error: Error | null;
  isSyncComplete: boolean;
};

const INITIAL_STATE: FeedItemsState = {
  loadedItems: undefined,
  status: 'loading',
  error: null,
  isSyncComplete: false,
};

export function useFeedItems(credentials: Credentials | null) {
  const { feeds } = useFeatureUseCases();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FeedItemsState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadSnapshot = async () => {
      try {
        const items = await feeds.loadFeedItems(credentials, {
          bypassCache: attempt > 0,
          signal: controller.signal,
          onCached: (cachedItems) => {
            if (!active || controller.signal.aborted) return;
            setState({
              loadedItems: cachedItems,
              status: 'success',
              error: null,
              isSyncComplete: false,
            });
          },
          onProgress: (partialItems) => {
            if (!active || controller.signal.aborted) return false;
            setState({
              loadedItems: partialItems,
              status: 'success',
              error: null,
              isSyncComplete: false,
            });
            return true;
          },
        });
        if (!active || controller.signal.aborted) return;

        setState({ loadedItems: items, status: 'success', error: null, isSyncComplete: true });
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        setState((currentState) => ({
          loadedItems: currentState.loadedItems,
          status: 'error',
          error: normalizedError,
          isSyncComplete: false,
        }));
      }
    };

    setState(INITIAL_STATE);
    void loadSnapshot();

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, credentials, feeds]);

  const retry = useCallback(() => {
    setState(INITIAL_STATE);
    setAttempt((value) => value + 1);
  }, []);

  const invalidateCache = useCallback(() => {
    feeds.invalidateFeedItemsCache(credentials);
  }, [credentials, feeds]);

  return {
    ...state,
    isLoading: state.loadedItems === undefined && state.status === 'loading',
    invalidateCache,
    retry,
  };
}
