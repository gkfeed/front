import { useCallback, useState } from 'react';

import { deleteFeedItemById } from '../services/feeds';
import type { Credentials } from '../types';

type DeletionStatus = 'idle' | 'deleting' | 'error';

export function useFeedItemDeletion(credentials: Credentials | null) {
  const [status, setStatus] = useState<DeletionStatus>('idle');

  const deleteItem = useCallback(async (itemId: number): Promise<boolean> => {
    if (status === 'deleting') return false;

    setStatus('deleting');
    try {
      await deleteFeedItemById(itemId, credentials);
      setStatus('idle');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, [credentials, status]);

  return {
    deleteItem,
    isDeleting: status === 'deleting',
    deleteFailed: status === 'error',
  };
}
