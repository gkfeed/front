import { useCallback, useMemo, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useAuth } from '../state/useAuth';
import { useFeedItemDeletion } from './useFeedItemDeletion';
import { useFeedItems } from './useFeedItems';
import { useReviewSession } from './useReviewSession';

export function useFeedReader() {
  const { credentials } = useAuth();
  const { nsfwMode } = useNsfwPreferences();
  const { loadedItems, status, isLoading, retry } = useFeedItems(credentials);
  const { deleteItem: deleteRemoteItem, isDeleting, deleteFailed } = useFeedItemDeletion(credentials);
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());

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

  const visibleItemIds = useMemo(() => new Set(items?.map((item) => item.id) ?? []), [items]);
  const { activeReviewIds, keep, remove, reset } = useReviewSession({
    loadedItems,
    reviewableIds,
    visibleItemIds,
    username: credentials?.username ?? null,
  });
  const currentItem = items?.find((item) => item.id === activeReviewIds[0]);

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    keep(currentItem.id);
  }, [currentItem, keep]);

  const deleteCurrentItem = useCallback(async () => {
    if (!currentItem) return;

    const deleted = await deleteRemoteItem(currentItem.id);
    if (!deleted) return;

    setDeletedItemIds((ids) => new Set(ids).add(currentItem.id));
    remove(currentItem.id);
  }, [currentItem, deleteRemoteItem, remove]);

  const retryLoad = useCallback(() => {
    reset();
    retry();
  }, [reset, retry]);

  const resetReview = useCallback(() => {
    reset();
  }, [reset]);

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
