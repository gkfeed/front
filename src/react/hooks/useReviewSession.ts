import { useCallback, useEffect, useMemo, useReducer } from 'react';

import type { FeedItem } from '../types';
import { createReviewQueueState, getActiveReviewIds } from './reviewQueue';
import {
  createReviewSessionState,
  reviewSessionReducer,
} from './reviewSessionMachine';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

export function useReviewSession({
  loadedItems,
  reviewableIds,
  visibleItemIds,
  username,
  isSyncComplete,
  orderKey,
}: {
  loadedItems: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: ReadonlySet<number>;
  username: string | null;
  isSyncComplete: boolean;
  orderKey: string;
}) {
  const storageKey = username ? getReviewStateStorageKey(username) : null;
  const [session, dispatch] = useReducer(
    reviewSessionReducer,
    undefined,
    createReviewSessionState,
  );

  useEffect(() => {
    dispatch({
      type: 'inputsChanged',
      loadedItems,
      storageKey,
      isSyncComplete,
      orderKey,
      reviewableIds,
      restoredState: readReviewState(storageKey),
    });
  }, [isSyncComplete, loadedItems, orderKey, reviewableIds, storageKey]);

  // Keep the established queue visible while cursor pages are incorporated by
  // the input event. A storage-key change still uses the new fallback queue.
  const isReady = loadedItems !== undefined
    && session.phase === 'ready'
    && session.storageKey === storageKey;
  const effectiveQueue = useMemo(
    () => isReady ? session.queue : createReviewQueueState(reviewableIds),
    [isReady, reviewableIds, session.queue],
  );
  const activeReviewIds = useMemo(() => {
    const activeIds = getActiveReviewIds(effectiveQueue, visibleItemIds);
    const pinnedId = session.pinnedCurrentId;
    if (
      pinnedId === undefined
      || !visibleItemIds.has(pinnedId)
      || (
        !effectiveQueue.pendingIds.includes(pinnedId)
        && !effectiveQueue.revisitIds.includes(pinnedId)
      )
    ) return activeIds;
    return [pinnedId, ...activeIds.filter((id) => id !== pinnedId)];
  }, [effectiveQueue, session.pinnedCurrentId, visibleItemIds]);

  useEffect(() => {
    if (!isReady) return;
    dispatch({ type: 'pinCurrent', id: activeReviewIds[0] });
  }, [activeReviewIds, isReady]);

  useEffect(() => {
    if (!isReady || !isSyncComplete || session.queueToPersist === null) return;
    writeReviewState(storageKey, session.queueToPersist);
    dispatch({ type: 'persistenceCompleted' });
  }, [isReady, isSyncComplete, session.queueToPersist, storageKey]);

  const keep = useCallback((id: number) => dispatch({ type: 'keep', id }), []);
  const remove = useCallback((id: number) => dispatch({ type: 'remove', id }), []);
  const reset = useCallback((ids: number[] = reviewableIds) => {
    dispatch({ type: 'reset', ids });
  }, [reviewableIds]);

  return { activeReviewIds, keep, remove, reset };
}
