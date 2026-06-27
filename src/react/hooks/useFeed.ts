import { useEffect, useState } from 'react';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { Feed } from '../types';

interface LoadResult {
  feed?: Feed;
  loadError?: string;
}

export function useFeed(feedIdParam: string | undefined, onDeleted: () => void) {
  const { credentials } = useAuth();
  const [loadResult, setLoadResult] = useState<LoadResult>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming' | 'deleting' | 'error'>('idle');
  const feedId = Number(feedIdParam);
  const isValidFeedId = Number.isSafeInteger(feedId) && feedId > 0;
  const { feed, loadError = '' } = loadResult ?? {};
  const isLoading = !loadResult;
  const isDeleting = deleteState === 'deleting';
  const isConfirmingDelete = deleteState !== 'idle';
  const deleteError = deleteState === 'error' ? 'Could not delete this feed source. Try again.' : '';

  useEffect(() => {
    setLoadResult(undefined);

    if (!isValidFeedId) {
      setLoadResult({ loadError: 'Feed source not found.' });
      return;
    }

    let isActive = true;

    getFeedById(feedId, credentials)
      .then((nextFeed) => {
        if (!isActive) return;
        setLoadResult(nextFeed ? { feed: nextFeed } : { loadError: 'Feed source not found.' });
      })
      .catch(() => {
        if (isActive) setLoadResult({ loadError: 'Could not load this feed source.' });
      });

    return () => {
      isActive = false;
    };
  }, [credentials, feedId, isValidFeedId, loadAttempt]);

  async function deleteFeed() {
    if (!isValidFeedId || isDeleting) return;

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
