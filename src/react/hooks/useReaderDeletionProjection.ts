import { useCallback, useEffect, useState } from 'react';

import type { FeedItem } from '../types';

export function useReaderDeletionProjection(loadedItems: FeedItem[] | undefined) {
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const [requeuedItemIds, setRequeuedItemIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (loadedItems === undefined || requeuedItemIds.size === 0) return;
    setRequeuedItemIds(new Set());
  }, [loadedItems, requeuedItemIds.size]);

  const markDeleted = useCallback((itemId: number) => {
    setDeletedItemIds((ids) => new Set(ids).add(itemId));
  }, []);

  const restoreFailed = useCallback((itemIds: number[]) => {
    if (itemIds.length === 0) return;
    const failedIds = new Set(itemIds);
    setDeletedItemIds((ids) => {
      const nextIds = new Set([...ids].filter((id) => !failedIds.has(id)));
      return nextIds.size === ids.size ? ids : nextIds;
    });
    setRequeuedItemIds(failedIds);
  }, []);

  return {
    deletedItemIds,
    requeuedItemIds,
    markDeleted,
    restoreFailed,
  };
}
