import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useNsfwPreferences } from '../../state/useNsfwPreferences';
import { useTikTokPreferences } from '../../state/useTikTokPreferences';
import { usePluginPreferences } from '../../state/usePluginPreferences';
import { useAuth } from '../../state/useAuth';
import type { ReaderItemOrder } from '../../state/readerItemOrder';
import { useFeedItems } from '../../hooks/useFeedItems';
import { useReviewSession } from '../../hooks/useReviewSession';
import { useReviewPreviewPrefetch } from '../../hooks/useReviewPreviewPrefetch';
import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { useFeedPriority } from '../../state/useFeedPriority';
import { useFeedDecisions } from '../../state/useFeedDecisions';
import { getEffectiveFeedPriorities } from '../../state/feedPriority';
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
  const { disabledPlugins } = usePluginPreferences();
  const { isManualEnabled, isAutomaticEnabled, priorities } = useFeedPriority();
  const { decisions, recordDecision } = useFeedDecisions(credentials?.username ?? null);
  const loadSources = useCallback(
    (signal: AbortSignal) => feeds.loadFeeds(credentials, signal),
    [credentials, feeds],
  );
  const { result: sources = [], error: sourceError, isLoading: isSourcesLoading, retry: retrySources } = useAsyncLoad(loadSources);
  const groupedFeedIds = useMemo(
    () => new Set(sources.filter(({ type }) => type.trim().toLowerCase() === 'rezka').map(({ id }) => id)),
    [sources],
  );
  const {
    loadedItems,
    status,
    error: loadError,
    isLoading: isFeedLoading,
    isSyncComplete,
    isSnapshotComplete,
    removeCachedItem,
    retry,
  } = useFeedItems(credentials);
  const feedPriorities = useMemo(
    () => getEffectiveFeedPriorities(
      isManualEnabled ? priorities : {},
      isAutomaticEnabled ? decisions : [],
    ),
    [decisions, isAutomaticEnabled, isManualEnabled, priorities],
  );
  const {
    items: reviewItems,
    currentItem: reviewCurrentItem,
    activeReviewIds,
    hasKeptItems,
    keep,
    keepFeed,
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
    isSnapshotComplete,
    isSyncFailed: status === 'error',
    itemOrder,
    nsfwMode,
    hideTikTokItems: hideTikTokItems && !disabledPlugins.has('tiktok'),
    feedPriorities,
    interleaveFeeds: isAutomaticEnabled,
  });
  const items = sourceError ? undefined : reviewItems;
  const currentItem = isSourcesLoading || sourceError ? undefined : reviewCurrentItem;
  const attemptedDeletions = useRef(new Set<string>());
  const deleteRemoteItem = useCallback(
    (itemId: number) => feeds.deleteFeedItem(itemId, credentials),
    [credentials, feeds],
  );
  const isLoading = isFeedLoading || isSourcesLoading
    || (status !== 'error' && !isSyncComplete && items?.length === 0 && !currentItem);

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
          removeCachedItem(deletion.itemId);
        })
        .catch(() => deletionFailed(deletion.itemId, deletion.operationId));
    });
  }, [deleteRemoteItem, deletionFailed, deletionSucceeded, deletions, removeCachedItem]);

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    recordDecision({ itemId: currentItem.id, feedId: currentItem.feedId, kept: true, decidedAt: Date.now() });
    if (groupedFeedIds.has(currentItem.feedId)) keepFeed(currentItem.id, currentItem.feedId);
    else keep(currentItem.id);
  }, [currentItem, groupedFeedIds, keep, keepFeed, recordDecision]);

  const deleteCurrentItem = useCallback(() => {
    if (!currentItem) return;

    recordDecision({ itemId: currentItem.id, feedId: currentItem.feedId, kept: false, decidedAt: Date.now() });
    startDeletion(currentItem.id, getItemTitle(currentItem));
  }, [currentItem, recordDecision, startDeletion]);

  const recoverFailedDeletion = useCallback((itemId: number) => {
    recoverDeletion(itemId);
  }, [recoverDeletion]);

  const retryLoad = useCallback(() => {
    retry();
    retrySources();
  }, [retry, retrySources]);

  const resetReview = useCallback(() => {
    reset();
  }, [reset]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isSyncComplete,
    isItemPending: (itemId: number) => deletions.some((deletion) => (
      deletion.itemId === itemId && deletion.status === 'pending'
    )),
    loadFailed: status === 'error' || sourceError !== null,
    loadError: sourceError ?? loadError,
    failedDeletions: deletions.filter((deletion) => deletion.status === 'failed'),
    remainingCount: activeReviewIds.length,
    hasKeptItems,
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
