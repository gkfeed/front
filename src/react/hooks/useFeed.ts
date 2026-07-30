import { useCallback, useState } from 'react';

import { useAsyncLoad } from './useAsyncLoad';
import { deleteFeedById, getFeedById } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import type { Credentials, Feed } from '../types';

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

const FEED_NOT_FOUND_MESSAGE = 'Feed source not found.';
const LOAD_ERROR_MESSAGE = 'Could not load this feed source.';
const DELETE_ERROR_MESSAGE = 'Could not delete this feed source. Try again.';

export function useFeed(feedIdParam: string | undefined, onDeleted: () => void) {
  const { credentials } = useAuth();
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const feedId = parseFeedId(feedIdParam);
  const load = useCallback(
    (signal: AbortSignal) => loadFeed(feedId, credentials, signal),
    [credentials, feedId],
  );
  const { result: feed, error: loadErrorValue, isLoading, retry: retryLoad } = useAsyncLoad(load);
  const isFeedNotFound = loadErrorValue instanceof FeedNotFoundError;
  const loadError = loadErrorValue
    ? isFeedNotFound ? FEED_NOT_FOUND_MESSAGE : LOAD_ERROR_MESSAGE
    : '';
  const isDeleting = deleteState === 'deleting';
  const isConfirmingDelete = deleteState !== 'idle';
  const canRetryLoad = Boolean(loadErrorValue) && !isFeedNotFound;
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

async function loadFeed(
  feedId: number | null,
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<Feed> {
  if (feedId === null) throw new FeedNotFoundError();

  const feed = await getFeedById(feedId, credentials, signal);
  if (!feed) throw new FeedNotFoundError();
  return feed;
}

class FeedNotFoundError extends Error {}

function parseFeedId(feedIdParam: string | undefined): number | null {
  const feedId = Number(feedIdParam);

  return Number.isSafeInteger(feedId) && feedId > 0 ? feedId : null;
}
