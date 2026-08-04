import { useCallback } from 'react';

import type { Credentials } from '../types';
import { useAsyncLoad } from './useAsyncLoad';
import { useFeatureUseCases } from '../state/useFeatureUseCases';

export function useFeedItems(credentials: Credentials | null) {
  const { feeds } = useFeatureUseCases();
  const load = useCallback(
    (signal: AbortSignal) => feeds.loadFeedItems(credentials, 1000, signal),
    [credentials, feeds],
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
