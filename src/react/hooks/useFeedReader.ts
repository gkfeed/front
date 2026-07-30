import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNsfwLink } from '../components/nsfw';
import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useAuth } from '../state/useAuth';
import { useAsyncLoad } from './useAsyncLoad';

type ActionState = 'idle' | 'deleting' | 'error';

export function useFeedReader() {
  const { credentials } = useAuth();
  const { nsfwMode } = useNsfwPreferences();
  const previousNsfwModeRef = useRef(nsfwMode);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const load = useCallback(
    (signal: AbortSignal) => getFeedItems(credentials, 1000, signal),
    [credentials],
  );
  const { result: loadedItems, status, isLoading, retry } = useAsyncLoad(load);
  const items = useMemo(
    () => loadedItems?.filter((item) => (
      !deletedItemIds.has(item.id)
      && (nsfwMode !== 'hide' || !isNsfwLink(item.link))
    )),
    [deletedItemIds, loadedItems, nsfwMode],
  );
  const currentItem = items?.[currentIndex];

  useEffect(() => {
    const previousMode = previousNsfwModeRef.current;
    previousNsfwModeRef.current = nsfwMode;
    if (previousMode === nsfwMode) return;
    if (previousMode === 'hide' || nsfwMode === 'hide') setCurrentIndex(0);
  }, [nsfwMode]);

  const advance = useCallback(() => {
    setActionState('idle');
    setCurrentIndex((index) => index + 1);
  }, []);

  const deleteItem = useCallback(async () => {
    if (!currentItem || actionState === 'deleting') return;

    setActionState('deleting');
    try {
      await deleteFeedItemById(currentItem.id, credentials);
      setDeletedItemIds((ids) => new Set(ids).add(currentItem.id));
      setActionState('idle');
    } catch {
      setActionState('error');
    }
  }, [actionState, credentials, currentItem]);

  const retryLoad = useCallback(() => {
    setCurrentIndex(0);
    setActionState('idle');
    retry();
  }, [retry]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isDeleting: actionState === 'deleting',
    loadFailed: status === 'error',
    deleteFailed: actionState === 'error',
    remainingCount: items ? Math.max(items.length - currentIndex, 0) : 0,
    keepItem: advance,
    deleteItem,
    retryLoad,
  };
}
