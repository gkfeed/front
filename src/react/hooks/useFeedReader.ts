import { useCallback, useMemo, useState } from 'react';

import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import { useAsyncLoad } from './useAsyncLoad';

export function useFeedReader() {
  const { credentials } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [deleteFailedItemIds, setDeleteFailedItemIds] = useState<Set<number>>(() => new Set());
  const load = useCallback(() => getFeedItems(credentials), [credentials]);
  const { result: loadedItems, isLoading, retry } = useAsyncLoad(load);
  const items = useMemo(
    () => loadedItems?.filter((item) => !deletedItemIds.has(item.id)),
    [deletedItemIds, loadedItems],
  );
  const currentItem = items?.[currentIndex];

  const advance = useCallback(() => {
    setCurrentIndex((index) => index + 1);
  }, []);

  const deleteItem = useCallback(async (requestedItemId?: number) => {
    const itemId = requestedItemId ?? currentItem?.id;
    if (itemId === undefined || deletingItemId !== null) return;

    setDeletingItemId(itemId);
    setDeleteFailedItemIds((failedIds) => withoutId(failedIds, itemId));
    try {
      await deleteFeedItemById(itemId, credentials);
      const deletedIndex = items?.findIndex((item) => item.id === itemId) ?? -1;
      setDeletedItemIds((deletedIds) => withId(deletedIds, itemId));
      if (deletedIndex >= 0) {
        setCurrentIndex((index) => deletedIndex < index ? Math.max(index - 1, 0) : index);
      }
    } catch {
      setDeleteFailedItemIds((failedIds) => withId(failedIds, itemId));
    } finally {
      setDeletingItemId(null);
    }
  }, [credentials, currentItem, deletingItemId, items]);

  const retryLoad = useCallback(() => {
    setCurrentIndex(0);
    setDeletedItemIds(new Set());
    setDeletingItemId(null);
    setDeleteFailedItemIds(new Set());
    retry();
  }, [retry]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isDeleting: deletingItemId !== null,
    isItemDeleting: (itemId: number) => deletingItemId === itemId,
    loadFailed: !isLoading && loadedItems === undefined,
    deleteFailed: currentItem ? deleteFailedItemIds.has(currentItem.id) : false,
    didItemDeleteFail: (itemId: number) => deleteFailedItemIds.has(itemId),
    remainingCount: items ? Math.max(items.length - currentIndex, 0) : 0,
    keepItem: advance,
    deleteItem,
    retryLoad,
  };
}

function withId(ids: Set<number>, itemId: number) {
  const nextIds = new Set(ids);
  nextIds.add(itemId);
  return nextIds;
}

function withoutId(ids: Set<number>, itemId: number) {
  if (!ids.has(itemId)) return ids;

  const nextIds = new Set(ids);
  nextIds.delete(itemId);
  return nextIds;
}
