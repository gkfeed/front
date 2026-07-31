import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useAuth } from '../state/useAuth';
import type { FeedItem } from '../types';
import { useFeedItemDeletion } from './useFeedItemDeletion';
import { useFeedItems } from './useFeedItems';
import {
  createReviewQueueState,
  getActiveReviewIds,
  reviewQueueReducer,
} from './reviewQueue';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

export function useFeedReader() {
  const { credentials } = useAuth();
  const { nsfwMode } = useNsfwPreferences();
  const { loadedItems, status, isLoading, retry } = useFeedItems(credentials);
  const { deleteItem: deleteRemoteItem, isDeleting, deleteFailed } = useFeedItemDeletion(credentials);
  const reviewStorageKey = credentials ? getReviewStateStorageKey(credentials.username) : null;
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const [reviewState, dispatchReview] = useReducer(
    reviewQueueReducer,
    createReviewQueueState([]),
  );
  const initializedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const initializedStorageKeyRef = useRef<string | null | undefined>(undefined);

  const items = useMemo(
    () => loadedItems?.filter((item) => (
      !deletedItemIds.has(item.id)
      && (nsfwMode !== 'hide' || !isNsfwLink(item.link))
    )),
    [deletedItemIds, loadedItems, nsfwMode],
  );
  const reviewableIds = useMemo(
    () => loadedItems
      ?.filter((item) => !deletedItemIds.has(item.id))
      .map((item) => item.id) ?? [],
    [deletedItemIds, loadedItems],
  );

  useEffect(() => {
    if (loadedItems === undefined) {
      initializedItemsRef.current = undefined;
      initializedStorageKeyRef.current = undefined;
      return;
    }
    if (
      loadedItems === initializedItemsRef.current
      && reviewStorageKey === initializedStorageKeyRef.current
    ) return;

    initializedItemsRef.current = loadedItems;
    initializedStorageKeyRef.current = reviewStorageKey;
    dispatchReview({
      type: 'restore',
      state: readReviewState(reviewStorageKey, reviewableIds)
        ?? createReviewQueueState(reviewableIds),
    });
  }, [loadedItems, reviewStorageKey, reviewableIds]);

  const reviewStateIsReady = loadedItems !== undefined
    && initializedItemsRef.current === loadedItems
    && initializedStorageKeyRef.current === reviewStorageKey;
  const effectiveReviewState = reviewStateIsReady
    ? reviewState
    : createReviewQueueState(reviewableIds);
  const visibleItemIds = useMemo(() => new Set(items?.map((item) => item.id) ?? []), [items]);
  const activeReviewIds = useMemo(
    () => getActiveReviewIds(effectiveReviewState, visibleItemIds),
    [effectiveReviewState, visibleItemIds],
  );
  const currentItem = items?.find((item) => item.id === activeReviewIds[0]);

  useEffect(() => {
    if (!reviewStateIsReady) return;
    writeReviewState(reviewStorageKey, reviewState);
  }, [reviewState, reviewStateIsReady, reviewStorageKey]);

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    dispatchReview({ type: 'keep', id: currentItem.id });
  }, [currentItem]);

  const deleteCurrentItem = useCallback(async () => {
    if (!currentItem) return;

    const deleted = await deleteRemoteItem(currentItem.id);
    if (!deleted) return;

    setDeletedItemIds((ids) => new Set(ids).add(currentItem.id));
    dispatchReview({ type: 'remove', id: currentItem.id });
  }, [currentItem, deleteRemoteItem]);

  const retryLoad = useCallback(() => {
    dispatchReview({ type: 'reset', ids: reviewableIds });
    retry();
  }, [retry, reviewableIds]);

  const resetReview = useCallback(() => {
    dispatchReview({ type: 'reset', ids: reviewableIds });
  }, [reviewableIds]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isDeleting,
    loadFailed: status === 'error',
    deleteFailed,
    remainingCount: activeReviewIds.length,
    keepItem,
    deleteItem: deleteCurrentItem,
    resetReview,
    retryLoad,
  };
}
