import { useCallback } from 'react';

import { getFeedItems } from '../services/feeds';
import type { Credentials } from '../types';
import { useAsyncLoad } from './useAsyncLoad';

export function useFeedItems(credentials: Credentials | null) {
  const load = useCallback(
    (signal: AbortSignal) => getFeedItems(credentials, 1000, signal),
    [credentials],
  );
  const { result: loadedItems, status, error, isLoading, retry } = useAsyncLoad(load);

  return {
    loadedItems,
    status,
    error,
    isLoading,
    retry,
  };
}
