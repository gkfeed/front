import { useCallback, useEffect, useState } from 'react';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { Feed } from '../types';

export function useFeed(feedIdParam: string | undefined, onDeleted: () => void) {
  const { credentials } = useAuth();
  const [feed, setFeed] = useState<Feed | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const feedId = Number(feedIdParam);

  useEffect(() => {
    let isActive = true;

    if (!Number.isFinite(feedId)) {
      setIsLoading(false);
      setLoadError('Feed source not found.');
      return;
    }

    setIsLoading(true);
    setLoadError('');

    getFeedById(feedId, credentials)
      .then((nextFeed) => {
        if (!isActive) return;
        if (!nextFeed) {
          setLoadError('Feed source not found.');
          return;
        }
        setFeed(nextFeed);
      })
      .catch(() => {
        if (isActive) setLoadError('Could not load this feed source.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [credentials, feedId]);

  const deleteFeed = useCallback(async () => {
    if (!Number.isFinite(feedId) || isDeleting) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      await deleteFeedById(feedId, credentials);
      onDeleted();
    } catch {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
      setDeleteError('Could not delete this feed source. Try again.');
    }
  }, [credentials, feedId, isDeleting, onDeleted]);

  const requestDelete = useCallback(() => {
    setDeleteError('');
    setIsConfirmingDelete(true);
  }, []);

  const cancelDelete = useCallback(() => {
    if (!isDeleting) setIsConfirmingDelete(false);
  }, [isDeleting]);

  return {
    feed,
    isLoading,
    isDeleting,
    isConfirmingDelete,
    loadError,
    deleteError,
    requestDelete,
    cancelDelete,
    deleteFeed,
  };
}
