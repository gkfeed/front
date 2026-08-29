import { useCallback, useEffect, useMemo, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useAuth } from '../state/useAuth';
import { useFeedItemDeletion } from './useFeedItemDeletion';
import { useFeedItems } from './useFeedItems';
import { useReviewSession } from './useReviewSession';
import { useReviewPreviewPrefetch } from './useReviewPreviewPrefetch';

export function useFeedReader({ prefetchNextPreviews = false }: { prefetchNextPreviews?: boolean } = {}) {
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
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const [requeuedItemIds, setRequeuedItemIds] = useState<Set<number>>(() => new Set());

  const items = useMemo(
    () => loadedItems?.filter((item) => (
      !deletedItemIds.has(item.id)
      && (nsfwMode !== 'hide' || !isNsfwLink(item.link))
    )),
    [deletedItemIds, loadedItems, nsfwMode],
  );
  const visibleReviewableIds = useMemo(
    () => loadedItems
      ?.filter((item) => !deletedItemIds.has(item.id))
      .map((item) => item.id) ?? [],
    [deletedItemIds, loadedItems],
  );
  const reviewableIds = useMemo(() => {
    const requeued = visibleReviewableIds.filter((id) => requeuedItemIds.has(id));
    return [
      ...visibleReviewableIds.filter((id) => !requeuedItemIds.has(id)),
      ...requeued,
    ];
  }, [requeuedItemIds, visibleReviewableIds]);

  useEffect(() => {
    if (loadedItems === undefined || requeuedItemIds.size === 0) return;
    setRequeuedItemIds(new Set());
  }, [loadedItems, requeuedItemIds.size]);

  const visibleItemIds = useMemo(() => new Set(items?.map((item) => item.id) ?? []), [items]);
  const { activeReviewIds, keep, remove, reset } = useReviewSession({
    loadedItems,
    reviewableIds,
    visibleItemIds,
    username: credentials?.username ?? null,
    isSyncComplete,
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

    setDeletedItemIds((ids) => new Set(ids).add(currentItem.id));
    remove(currentItem.id);
  }, [currentItem, deleteRemoteItem, remove]);

  const retryFailedDeletion = useCallback((itemId: number) => {
    retryItem(itemId);
  }, [retryItem]);

  const retryLoad = useCallback(() => {
    const failedIds = failedDeletions.map((operation) => operation.itemId);
    if (failedIds.length > 0) {
      const failedIdSet = new Set(failedIds);
      setDeletedItemIds((ids) => {
        const nextIds = new Set([...ids].filter((id) => !failedIdSet.has(id)));
        return nextIds.size === ids.size ? ids : nextIds;
      });
      setRequeuedItemIds(failedIdSet);
      reset([...reviewableIds, ...failedIds]);
    } else {
      reset();
    }
    retry();
  }, [failedDeletions, reset, retry, reviewableIds]);

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
