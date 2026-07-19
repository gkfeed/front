import { useCallback, useState } from 'react';

import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import { useAsyncLoad } from './useAsyncLoad';

type ActionState = 'idle' | 'deleting' | 'error';

export function useFeedReader() {
  const { credentials } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const load = useCallback(() => getFeedItems(credentials), [credentials]);
  const { result: items, isLoading, retry } = useAsyncLoad(load);
  const currentItem = items?.[currentIndex];

  const advance = useCallback(() => {
    setActionState('idle');
    setCurrentIndex((index) => index + 1);
  }, []);

  const deleteItem = useCallback(async () => {
    if (!currentItem || actionState === 'deleting') return;

    setActionState('deleting');
    try {
      await deleteFeedItemById(currentItem.id, credentials);
      advance();
    } catch {
      setActionState('error');
    }
  }, [actionState, advance, credentials, currentItem]);

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
    loadFailed: !isLoading && items === undefined,
    deleteFailed: actionState === 'error',
    remainingCount: items ? Math.max(items.length - currentIndex, 0) : 0,
    keepItem: advance,
    deleteItem,
    retryLoad,
  };
}
