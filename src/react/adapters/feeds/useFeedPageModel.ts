import { useCallback, useState } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { useAuth } from '../../state/useAuth';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';
import { getRequestErrorMessage, isNotFoundError } from '../../services/authError';

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';
export type FeedLoadStatus = 'loading' | 'success' | 'error' | 'not-found';
export type FeedDeleteStatus = DeleteState;

export function useFeedPageModel(
  feedIdParam: string | undefined,
  onDeleted: () => void,
  t: (key: string) => string,
) {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const feedId = parseFeedId(feedIdParam);
  const load = useCallback(
    (signal: AbortSignal) => feeds.loadFeed(feedId, credentials, signal),
    [credentials, feedId, feeds],
  );
  const {
    result: feed,
    status: asyncLoadStatus,
    error: loadError,
    retry: retryLoad,
  } = useAsyncLoad(load);
  const loadStatus: FeedLoadStatus = (feeds.isFeedNotFoundError(loadError)
    || isNotFoundError(loadError))
    ? 'not-found'
    : asyncLoadStatus;
  const loadErrorMessage = loadStatus === 'error'
    ? getRequestErrorMessage(loadError, t, 'feedDetails.loadError')
    : '';
  const isDeleting = deleteState === 'deleting';

  const deleteLoadedFeed = useCallback(async () => {
    if (feedId === null || isDeleting) return;

    setDeleteState('deleting');

    try {
      await feeds.deleteFeed(feedId, credentials);
      onDeleted();
    } catch {
      setDeleteState('error');
    }
  }, [credentials, feedId, feeds, isDeleting, onDeleted]);

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
    loadErrorMessage,
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
