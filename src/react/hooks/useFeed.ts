import { useCallback, useState } from 'react';

import { useAsyncLoad } from './useAsyncLoad';
import { deleteFeedById, getFeedById } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import type { Credentials, Feed } from '../types';

interface LoadResult {
  feed?: Feed;
  loadError?: string;
  canRetryLoad?: boolean;
}

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

const FEED_NOT_FOUND_MESSAGE = 'Feed source not found.';
const LOAD_ERROR_MESSAGE = 'Could not load this feed source.';
const DELETE_ERROR_MESSAGE = 'Could not delete this feed source. Try again.';

export function useFeed(feedIdParam: string | undefined, onDeleted: () => void) {
  const { credentials } = useAuth();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const feedId = parseFeedId(feedIdParam);
  const load = useCallback(() => loadFeed(feedId, credentials), [credentials, feedId]);
  const { result: loadResult, isLoading, retry: retryLoad } = useAsyncLoad(load);
  const { feed, loadError = '' } = loadResult ?? {};
  const isDeleting = deleteState === 'deleting';
  const isConfirmingDelete = deleteState !== 'idle';
  const canRetryLoad = loadResult?.canRetryLoad ?? false;
  const deleteError = deleteState === 'error' ? DELETE_ERROR_MESSAGE : '';

  async function deleteFeed() {
    if (feedId === null || isDeleting) return;

    setDeleteState('deleting');

    try {
      await deleteFeedById(feedId, credentials);
      onDeleted();
    } catch {
      setDeleteState('error');
    }
  }

  function requestDelete() {
    setDeleteState('confirming');
  }

  function cancelDelete() {
    if (!isDeleting) setDeleteState('idle');
  }

  return {
    feed,
    isLoading,
    isDeleting,
    isConfirmingDelete,
    canRetryLoad,
    loadError,
    deleteError,
    retryLoad,
    requestDelete,
    cancelDelete,
    deleteFeed,
  };
}

async function loadFeed(feedId: number | null, credentials: Credentials | null): Promise<LoadResult> {
  if (feedId === null) return { loadError: FEED_NOT_FOUND_MESSAGE };

  try {
    const feed = await getFeedById(feedId, credentials);
    return feed ? { feed } : { loadError: FEED_NOT_FOUND_MESSAGE };
  } catch {
    return { loadError: LOAD_ERROR_MESSAGE, canRetryLoad: true };
  }
}

function parseFeedId(feedIdParam: string | undefined): number | null {
  const feedId = Number(feedIdParam);

  return Number.isSafeInteger(feedId) && feedId > 0 ? feedId : null;
}
