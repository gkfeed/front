import { useCallback, useEffect, useMemo, useReducer } from 'react';

import type { FeedItem } from '../types';
import {
  createReviewSessionState,
  getActiveReviewIds,
  reviewSessionReducer,
  type ReviewPresentation,
} from './reviewSession';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

export function useReviewSession({
  loadedItems,
  username,
  isSyncComplete,
  itemOrder,
  nsfwMode,
  hideTikTokItems,
  deletedItemIds,
  requeuedItemIds,
  feedPriorities,
}: ReviewPresentation & {
  loadedItems: FeedItem[] | undefined;
  username: string | null;
  isSyncComplete: boolean;
}) {
  const storageKey = username ? getReviewStateStorageKey(username) : null;
  const presentation = useMemo(() => ({
    itemOrder,
    nsfwMode,
    hideTikTokItems,
    deletedItemIds,
    requeuedItemIds,
    feedPriorities,
  }), [
    deletedItemIds,
    feedPriorities,
    hideTikTokItems,
    itemOrder,
    nsfwMode,
    requeuedItemIds,
  ]);
  const [session, dispatch] = useReducer(
    reviewSessionReducer,
    presentation,
    createReviewSessionState,
  );

  useEffect(() => {
    dispatch({
      type: 'sessionChanged',
      storageKey,
      restoredProgress: readReviewState(storageKey),
    });
  }, [storageKey]);

  useEffect(() => {
    dispatch({ type: 'snapshotChanged', items: loadedItems, isComplete: isSyncComplete });
  }, [isSyncComplete, loadedItems, storageKey]);

  useEffect(() => {
    dispatch({ type: 'presentationChanged', presentation });
  }, [presentation]);

  useEffect(() => {
    if (session.progressToPersist === null) return;
    writeReviewState(storageKey, session.progressToPersist);
    dispatch({ type: 'persistenceCompleted', progress: session.progressToPersist });
  }, [session.progressToPersist, storageKey]);

  const activeReviewIds = useMemo(() => getActiveReviewIds(session), [session]);

  const keep = useCallback((id: number) => dispatch({ type: 'keep', id }), []);
  const remove = useCallback((id: number) => dispatch({ type: 'remove', id }), []);
  const reset = useCallback((ids?: number[]) => {
    dispatch({ type: 'reset', ids });
  }, []);

  return {
    items: session.items,
    reviewableIds: session.reviewableIds,
    activeReviewIds,
    keep,
    remove,
    reset,
  };
}
