import { useEffect, useState } from 'react';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { Feed } from '../types';

interface LoadResult {
  feed?: Feed;
  loadError?: string;
}

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

const FEED_NOT_FOUND_MESSAGE = 'Feed source not found.';
const LOAD_ERROR_MESSAGE = 'Could not load this feed source.';
const DELETE_ERROR_MESSAGE = 'Could not delete this feed source. Try again.';

export function useFeed(feedIdParam: string | undefined, onDeleted: () => void) {
  const { credentials } = useAuth();
  const [loadResult, setLoadResult] = useState<LoadResult>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
  const feedId = parseFeedId(feedIdParam);
  const { feed, loadError = '' } = loadResult ?? {};
  const isLoading = !loadResult;
  const isDeleting = deleteState === 'deleting';
  const isConfirmingDelete = deleteState !== 'idle';
  const deleteError = deleteState === 'error' ? DELETE_ERROR_MESSAGE : '';

  useEffect(() => {
    setLoadResult(undefined);

    if (feedId === null) {
      setLoadResult({ loadError: FEED_NOT_FOUND_MESSAGE });
      return;
    }

    let isActive = true;

    getFeedById(feedId, credentials)
      .then((nextFeed) => {
        if (!isActive) return;
        setLoadResult(nextFeed ? { feed: nextFeed } : { loadError: FEED_NOT_FOUND_MESSAGE });
      })
      .catch(() => {
        if (isActive) setLoadResult({ loadError: LOAD_ERROR_MESSAGE });
      });

    return () => {
      isActive = false;
    };
  }, [credentials, feedId, loadAttempt]);

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
    loadError,
    deleteError,
    retryLoad: () => setLoadAttempt((value) => value + 1),
    requestDelete,
    cancelDelete,
    deleteFeed,
  };
}

function parseFeedId(feedIdParam: string | undefined): number | null {
  const feedId = Number(feedIdParam);

  return Number.isSafeInteger(feedId) && feedId > 0 ? feedId : null;
}
