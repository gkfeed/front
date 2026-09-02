import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNsfwPreferences } from '../../state/useNsfwPreferences';
import { useTikTokPreferences } from '../../state/useTikTokPreferences';
import { useAuth } from '../../state/useAuth';
import type { ReaderItemOrder } from '../../state/readerItemOrder';
import { useFeedItems } from '../../hooks/useFeedItems';
import { useReviewSession } from '../../hooks/useReviewSession';
import { useReviewPreviewPrefetch } from '../../hooks/useReviewPreviewPrefetch';
import { useFeedPriority } from '../../state/useFeedPriority';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';

/** Connects the Reader transaction model to loading, deletion, and cache I/O. */
export function useFeedReader({
  prefetchNextPreviews = false,
  itemOrder = 'desc',
}: {
  prefetchNextPreviews?: boolean;
  itemOrder?: ReaderItemOrder;
} = {}) {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const { nsfwMode } = useNsfwPreferences();
  const { hideTikTokItems } = useTikTokPreferences();
  const { priorities: feedPriorities } = useFeedPriority();
  const {
    loadedItems,
    status,
    error: loadError,
    isLoading: isFeedLoading,
    isSyncComplete,
    invalidateCache,
    retry,
  } = useFeedItems(credentials);
  const reviewPresentation = useMemo(() => ({
    itemOrder,
    nsfwMode,
    hideTikTokItems,
    feedPriorities,
  }), [
    feedPriorities,
    hideTikTokItems,
    itemOrder,
    nsfwMode,
  ]);
  const {
    items,
    activeReviewIds,
    keep,
    deleteItem: startDeletion,
    deletionSucceeded,
    deletionFailed,
    recoverDeletion,
    deletions,
    reset,
  } = useReviewSession({
    loadedItems,
    username: credentials?.username ?? null,
    isSyncComplete,
    ...reviewPresentation,
  });
  const currentItem = items?.find((item) => item.id === activeReviewIds[0]);
  const attemptedDeletions = useRef(new Set<string>());
  const deleteRemoteItem = useCallback(
    (itemId: number) => feeds.deleteFeedItem(itemId, credentials),
    [credentials, feeds],
  );
  const isLoading = isFeedLoading
    || (status !== 'error' && !isSyncComplete && items?.length === 0);

  useReviewPreviewPrefetch({
    enabled: prefetchNextPreviews,
    items: items ?? [],
    activeReviewIds,
  });

  useEffect(() => {
    deletions.forEach((deletion) => {
      if (deletion.status !== 'pending') return;
      const attemptKey = `${deletion.operationId}:${deletion.attempt}`;
      if (attemptedDeletions.current.has(attemptKey)) return;
      attemptedDeletions.current.add(attemptKey);

      void deleteRemoteItem(deletion.itemId)
        .then(() => {
          deletionSucceeded(deletion.itemId, deletion.operationId);
          invalidateCache();
        })
        .catch(() => deletionFailed(deletion.itemId, deletion.operationId));
    });
  }, [deleteRemoteItem, deletionFailed, deletionSucceeded, deletions, invalidateCache]);

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    keep(currentItem.id);
  }, [currentItem, keep]);

  const deleteCurrentItem = useCallback(() => {
    if (!currentItem) return;

    startDeletion(currentItem.id, getItemTitle(currentItem));
  }, [currentItem, startDeletion]);

  const recoverFailedDeletion = useCallback((itemId: number) => {
    recoverDeletion(itemId);
  }, [recoverDeletion]);

  const retryLoad = useCallback(() => {
    retry();
  }, [retry]);

  const resetReview = useCallback(() => {
    reset();
  }, [reset]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isItemPending: (itemId: number) => deletions.some((deletion) => (
      deletion.itemId === itemId && deletion.status === 'pending'
    )),
    loadFailed: status === 'error',
    loadError,
    failedDeletions: deletions.filter((deletion) => deletion.status === 'failed'),
    remainingCount: activeReviewIds.length,
    keepItem,
    deleteItem: deleteCurrentItem,
    recoverDeletion: recoverFailedDeletion,
    resetReview,
    retryLoad,
  };
}

function getItemTitle(item: { title: string; text: string }): string {
  return item.title.trim() || item.text.trim();
}
