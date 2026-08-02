import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { FeedItem } from '../types';
import {
  createReviewQueueState,
  getActiveReviewIds,
  reviewQueueReducer,
} from './reviewQueue';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

export function useReviewSession({
  loadedItems,
  reviewableIds,
  visibleItemIds,
  username,
}: {
  loadedItems: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: ReadonlySet<number>;
  username: string | null;
}) {
  const storageKey = username ? getReviewStateStorageKey(username) : null;
  const [reviewState, dispatchReview] = useReducer(
    reviewQueueReducer,
    createReviewQueueState([]),
  );
  const initializedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const initializedStorageKeyRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (loadedItems === undefined) {
      initializedItemsRef.current = undefined;
      initializedStorageKeyRef.current = undefined;
      return;
    }
    if (
      loadedItems === initializedItemsRef.current
      && storageKey === initializedStorageKeyRef.current
    ) return;

    initializedItemsRef.current = loadedItems;
    initializedStorageKeyRef.current = storageKey;
    dispatchReview({
      type: 'restore',
      state: readReviewState(storageKey, reviewableIds)
        ?? createReviewQueueState(reviewableIds),
    });
  }, [loadedItems, reviewableIds, storageKey]);

  const isReady = loadedItems !== undefined
    && initializedItemsRef.current === loadedItems
    && initializedStorageKeyRef.current === storageKey;
  const effectiveState = useMemo(
    () => isReady ? reviewState : createReviewQueueState(reviewableIds),
    [isReady, reviewState, reviewableIds],
  );
  const activeReviewIds = useMemo(
    () => getActiveReviewIds(effectiveState, visibleItemIds),
    [effectiveState, visibleItemIds],
  );

  useEffect(() => {
    if (!isReady) return;
    writeReviewState(storageKey, reviewState);
  }, [isReady, reviewState, storageKey]);

  const keep = useCallback((id: number) => {
    dispatchReview({ type: 'keep', id });
  }, []);
  const remove = useCallback((id: number) => {
    dispatchReview({ type: 'remove', id });
  }, []);
  const reset = useCallback((ids: number[] = reviewableIds) => {
    dispatchReview({ type: 'reset', ids });
  }, [reviewableIds]);

  return { activeReviewIds, keep, remove, reset };
}
