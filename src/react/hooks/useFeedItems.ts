import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deleteFeedItemsCache,
  readFeedItemsCache,
  writeFeedItemsCache,
} from '../services/feedItemsCache';
import type { Credentials, FeedItem } from '../types';
import { useFeatureUseCases } from '../state/useFeatureUseCases';

const CACHE_FRESHNESS_MS = 15_000;
const INITIAL_PAGE_SIZE = 10;

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
  const cacheRevisionRef = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const cacheRevision = cacheRevisionRef.current;

    const loadSnapshot = async () => {
      try {
        let cachedItems: FeedItem[] | undefined;
        if (attempt === 0 && credentials?.username) {
          cachedItems = await readFeedItemsCache(credentials.username, CACHE_FRESHNESS_MS) ?? undefined;
          if (!active || controller.signal.aborted) return;
          if (cachedItems) {
            setState({
              loadedItems: cachedItems,
              status: 'success',
              error: null,
              isSyncComplete: false,
            });
          }
        }

        const items = await feeds.loadFeedItems(
          credentials,
          undefined,
          controller.signal,
          (partialItems) => {
            if (!active || controller.signal.aborted) return false;
            setState({
              loadedItems: partialItems,
              status: 'success',
              error: null,
              isSyncComplete: false,
            });
            return true;
          },
          INITIAL_PAGE_SIZE,
        );
        if (!active || controller.signal.aborted) return;

        setState({ loadedItems: items, status: 'success', error: null, isSyncComplete: true });
        if (credentials?.username && cacheRevisionRef.current === cacheRevision) {
          void writeFeedItemsCache(credentials.username, items);
        }
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
    cacheRevisionRef.current += 1;
    if (credentials?.username) void deleteFeedItemsCache(credentials.username);
  }, [credentials?.username]);

  return {
    ...state,
    isLoading: state.loadedItems === undefined && state.status === 'loading',
    invalidateCache,
    retry,
  };
}
