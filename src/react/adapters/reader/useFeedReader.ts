import { useCallback, useMemo } from 'react';

import { useNsfwPreferences } from '../../state/useNsfwPreferences';
import { useAuth } from '../../state/useAuth';
import type { ReaderItemOrder } from '../../state/readerItemOrder';
import { projectReaderItems } from '../../hooks/readerItemsProjection';
import { useFeedItemDeletion } from '../../hooks/useFeedItemDeletion';
import { useFeedItems } from '../../hooks/useFeedItems';
import { useReaderDeletionProjection } from '../../hooks/useReaderDeletionProjection';
import { useReviewSession } from '../../hooks/useReviewSession';
import { useReviewPreviewPrefetch } from '../../hooks/useReviewPreviewPrefetch';

/** Coordinates the reader use case; lower-level hooks own the individual mechanisms. */
export function useFeedReader({
  prefetchNextPreviews = false,
  itemOrder = 'desc',
}: {
  prefetchNextPreviews?: boolean;
  itemOrder?: ReaderItemOrder;
} = {}) {
  const { credentials } = useAuth();
  const { nsfwMode } = useNsfwPreferences();
  const {
    loadedItems,
    status,
    error: loadError,
    isLoading,
    isSyncComplete,
    invalidateCache,
    retry,
  } = useFeedItems(credentials);
  const {
    deleteItem: deleteRemoteItem,
    failedDeletions,
    isItemPending,
    retryItem,
  } = useFeedItemDeletion(credentials, invalidateCache);
  const {
    deletedItemIds,
    requeuedItemIds,
    markDeleted,
    restoreFailed,
  } = useReaderDeletionProjection(loadedItems);
  const { items, reviewableIds, visibleItemIds } = useMemo(() => projectReaderItems({
    loadedItems,
    itemOrder,
    nsfwMode,
    deletedItemIds,
    requeuedItemIds,
  }), [
    deletedItemIds,
    itemOrder,
    loadedItems,
    nsfwMode,
    requeuedItemIds,
  ]);
  const { activeReviewIds, keep, remove, reset } = useReviewSession({
    loadedItems,
    reviewableIds,
    visibleItemIds,
    username: credentials?.username ?? null,
    isSyncComplete,
    orderKey: itemOrder,
  });
  const currentItem = items?.find((item) => item.id === activeReviewIds[0]);

  useReviewPreviewPrefetch({
    enabled: prefetchNextPreviews,
    items: items ?? [],
    activeReviewIds,
  });

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    keep(currentItem.id);
  }, [currentItem, keep]);

  const deleteCurrentItem = useCallback(() => {
    if (!currentItem) return;

    const deleted = deleteRemoteItem(currentItem.id, getItemTitle(currentItem));
    if (!deleted) return;

    markDeleted(currentItem.id);
    remove(currentItem.id);
  }, [currentItem, deleteRemoteItem, markDeleted, remove]);

  const retryFailedDeletion = useCallback((itemId: number) => {
    retryItem(itemId);
  }, [retryItem]);

  const retryLoad = useCallback(() => {
    const failedIds = failedDeletions.map((operation) => operation.itemId);
    if (failedIds.length > 0) {
      restoreFailed(failedIds);
      reset([...reviewableIds, ...failedIds]);
    } else {
      reset();
    }
    retry();
  }, [failedDeletions, reset, restoreFailed, retry, reviewableIds]);

  const resetReview = useCallback(() => {
    reset();
  }, [reset]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isItemPending,
    loadFailed: status === 'error',
    loadError,
    failedDeletions,
    remainingCount: activeReviewIds.length,
    keepItem,
    deleteItem: deleteCurrentItem,
    retryDelete: retryFailedDeletion,
    resetReview,
    retryLoad,
  };
}

function getItemTitle(item: { title: string; text: string }): string {
  return item.title.trim() || item.text.trim();
}
