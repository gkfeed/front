import { useCallback, useState } from 'react';

import { isNotFoundError } from '../requestError';
import { useAuth } from '../../state/useAuth';
import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import {
  deleteFeed,
  isFeedNotFoundError,
  loadFeed,
} from './feedUseCases';

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';
export type FeedLoadStatus = 'loading' | 'success' | 'error' | 'not-found';
export type FeedDeleteStatus = DeleteState;

export function useFeedPageModel(
  feedIdParam: string | undefined,
  onDeleted: () => void,
) {
  const { credentials } = useAuth();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const feedId = parseFeedId(feedIdParam);
  const load = useCallback(
    (signal: AbortSignal) => loadFeed(feedId, credentials, signal),
    [credentials, feedId],
  );
  const {
    result: feed,
    status: asyncLoadStatus,
    error: loadError,
    retry: retryLoad,
  } = useAsyncLoad(load);
  const loadStatus: FeedLoadStatus = (isFeedNotFoundError(loadError) || isNotFoundError(loadError))
    ? 'not-found'
    : asyncLoadStatus;
  const isDeleting = deleteState === 'deleting';

  const deleteLoadedFeed = useCallback(async () => {
    if (feedId === null || isDeleting) return;

    setDeleteState('deleting');

    try {
      await deleteFeed(feedId, credentials);
      onDeleted();
    } catch {
      setDeleteState('error');
    }
  }, [credentials, feedId, isDeleting, onDeleted]);

  const requestDelete = useCallback(() => {
    setDeleteState('confirming');
  }, []);

  const cancelDelete = useCallback(() => {
    if (!isDeleting) setDeleteState('idle');
  }, [isDeleting]);

  return {
    feed,
    loadStatus,
    loadError,
    deleteStatus: deleteState,
    retryLoad,
    requestDelete,
    cancelDelete,
    deleteFeed: deleteLoadedFeed,
  };
}

function parseFeedId(feedIdParam: string | undefined): number | null {
  const feedId = Number(feedIdParam);

  return Number.isSafeInteger(feedId) && feedId > 0 ? feedId : null;
}
