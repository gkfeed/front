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
  isSyncComplete,
}: {
  loadedItems: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: ReadonlySet<number>;
  username: string | null;
  isSyncComplete: boolean;
}) {
  const storageKey = username ? getReviewStateStorageKey(username) : null;
  const [reviewState, dispatchReview] = useReducer(
    reviewQueueReducer,
    createReviewQueueState([]),
  );
  const initializedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const initializedStorageKeyRef = useRef<string | null | undefined>(undefined);
  const initializedSyncCompleteRef = useRef<boolean | undefined>(undefined);
  const restoredSessionRef = useRef(false);
  const restoredIdsRef = useRef<ReadonlySet<number>>(new Set());
  const reconciliationPendingRef = useRef(false);
  const pinnedCurrentIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (loadedItems === undefined) {
      initializedItemsRef.current = undefined;
      initializedStorageKeyRef.current = undefined;
      initializedSyncCompleteRef.current = undefined;
      restoredSessionRef.current = false;
      restoredIdsRef.current = new Set();
      reconciliationPendingRef.current = false;
      pinnedCurrentIdRef.current = undefined;
      return;
    }
    if (
      loadedItems === initializedItemsRef.current
      && storageKey === initializedStorageKeyRef.current
      && isSyncComplete === initializedSyncCompleteRef.current
    ) return;

    const isInitialLoad = initializedItemsRef.current === undefined
      || storageKey !== initializedStorageKeyRef.current;
    initializedItemsRef.current = loadedItems;
    initializedStorageKeyRef.current = storageKey;
    initializedSyncCompleteRef.current = isSyncComplete;
    if (isInitialLoad) {
      const restoredState = readReviewState(storageKey);
      restoredSessionRef.current = restoredState !== null;
      restoredIdsRef.current = new Set(restoredState ? [
        ...restoredState.pendingIds,
        ...restoredState.revisitIds,
        ...restoredState.keptItemIds,
      ] : []);
      dispatchReview({
        type: 'restore',
        state: restoredState ?? createReviewQueueState(reviewableIds),
      });
      if (restoredState && isSyncComplete) {
        reconciliationPendingRef.current = true;
        dispatchReview({ type: 'reconcile', ids: reviewableIds });
      } else if (restoredState) {
        dispatchReview({
          type: 'extendRestored',
          ids: reviewableIds,
          restoredIds: restoredIdsRef.current,
        });
      }
      return;
    }

    if (isSyncComplete) {
      if (restoredSessionRef.current) pinnedCurrentIdRef.current = undefined;
      reconciliationPendingRef.current = true;
      dispatchReview({ type: 'reconcile', ids: reviewableIds });
    } else if (restoredSessionRef.current) {
      dispatchReview({
        type: 'extendRestored',
        ids: reviewableIds,
        restoredIds: restoredIdsRef.current,
      });
    } else {
      dispatchReview({ type: 'extend', ids: reviewableIds });
    }
  }, [isSyncComplete, loadedItems, reviewableIds, storageKey]);

  // Once a session is initialized, cursor pages must not make it temporarily
  // fall back to a brand-new queue. That fallback can replace the current item
  // for one render before the reconciliation effect runs.
  const isReady = loadedItems !== undefined
    && initializedItemsRef.current !== undefined
    && initializedStorageKeyRef.current === storageKey;
  const effectiveState = useMemo(
    () => isReady ? reviewState : createReviewQueueState(reviewableIds),
    [isReady, reviewState, reviewableIds],
  );
  const activeReviewIds = useMemo(() => {
    const activeIds = getActiveReviewIds(effectiveState, visibleItemIds);
    const pinnedId = pinnedCurrentIdRef.current;
    if (
      pinnedId === undefined
      || !visibleItemIds.has(pinnedId)
      || (
        !effectiveState.pendingIds.includes(pinnedId)
        && !effectiveState.revisitIds.includes(pinnedId)
      )
    ) {
      return activeIds;
    }
    return [pinnedId, ...activeIds.filter((id) => id !== pinnedId)];
  }, [effectiveState, visibleItemIds]);

  useEffect(() => {
    if (!isReady) return;
    pinnedCurrentIdRef.current = activeReviewIds[0];
  }, [activeReviewIds, isReady]);

  useEffect(() => {
    if (!isReady || !isSyncComplete) return;
    if (reconciliationPendingRef.current) {
      reconciliationPendingRef.current = false;
      return;
    }
    writeReviewState(storageKey, reviewState);
  }, [isReady, isSyncComplete, reviewState, storageKey]);

  const keep = useCallback((id: number) => {
    pinnedCurrentIdRef.current = undefined;
    dispatchReview({ type: 'keep', id });
  }, []);
  const remove = useCallback((id: number) => {
    pinnedCurrentIdRef.current = undefined;
    dispatchReview({ type: 'remove', id });
  }, []);
  const reset = useCallback((ids: number[] = reviewableIds) => {
    pinnedCurrentIdRef.current = undefined;
    dispatchReview({ type: 'reset', ids });
  }, [reviewableIds]);

  return { activeReviewIds, keep, remove, reset };
}
