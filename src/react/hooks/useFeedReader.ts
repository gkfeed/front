import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useAuth } from '../state/useAuth';
import type { FeedItem } from '../types';
import { getObjectProperty } from '../unknownObject';
import { useAsyncLoad } from './useAsyncLoad';

type ActionState = 'idle' | 'deleting' | 'error';
type ReviewState = {
  pendingIds: number[];
  revisitIds: number[];
  keptItemIds: Set<number>;
};

const REVIEW_STATE_STORAGE_KEY = 'gkfeed.reader-review.v1';

export function useFeedReader() {
  const { credentials } = useAuth();
  const { nsfwMode } = useNsfwPreferences();
  const reviewStorageKey = credentials
    ? `${REVIEW_STATE_STORAGE_KEY}.${encodeURIComponent(credentials.username)}`
    : null;
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [deletedItemIds, setDeletedItemIds] = useState<Set<number>>(() => new Set());
  const [reviewState, setReviewState] = useState<ReviewState>(() => createReviewState([]));
  const loadedItemsRef = useRef<FeedItem[] | undefined>(undefined);
  const loadedStorageKeyRef = useRef<string | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => getFeedItems(credentials, 1000, signal),
    [credentials],
  );
  const { result: loadedItems, status, isLoading, retry } = useAsyncLoad(load);
  const items = useMemo(
    () => loadedItems?.filter((item) => (
      !deletedItemIds.has(item.id)
      && (nsfwMode !== 'hide' || !isNsfwLink(item.link))
    )),
    [deletedItemIds, loadedItems, nsfwMode],
  );
  const reviewableIds = useMemo(
    () => loadedItems
      ?.filter((item) => !deletedItemIds.has(item.id))
      .map((item) => item.id) ?? [],
    [deletedItemIds, loadedItems],
  );

  useEffect(() => {
    if (loadedItems === undefined) {
      loadedItemsRef.current = undefined;
      loadedStorageKeyRef.current = null;
      return;
    }
    if (
      loadedItems === loadedItemsRef.current
      && reviewStorageKey === loadedStorageKeyRef.current
    ) return;
    loadedItemsRef.current = loadedItems;
    loadedStorageKeyRef.current = reviewStorageKey;
    setReviewState(readReviewState(reviewStorageKey, reviewableIds) ?? createReviewState(reviewableIds));
  }, [loadedItems, reviewStorageKey, reviewableIds]);

  const reviewStateIsReady = loadedItems !== undefined
    && loadedItemsRef.current === loadedItems
    && loadedStorageKeyRef.current === reviewStorageKey;
  const effectiveReviewState = !reviewStateIsReady
    ? readReviewState(reviewStorageKey, reviewableIds) ?? createReviewState(reviewableIds)
    : reviewState;
  const visibleItemIds = useMemo(() => new Set(items?.map((item) => item.id) ?? []), [items]);
  const activeReviewIds = useMemo(() => {
    const pendingIds = effectiveReviewState.pendingIds.filter((id) => visibleItemIds.has(id));
    if (pendingIds.length > 0) return pendingIds;
    return effectiveReviewState.revisitIds.filter((id) => visibleItemIds.has(id));
  }, [effectiveReviewState, visibleItemIds]);
  const currentItem = items?.find((item) => item.id === activeReviewIds[0]);

  useEffect(() => {
    if (!reviewStateIsReady) return;
    writeReviewState(reviewStorageKey, reviewState);
  }, [reviewState, reviewStateIsReady, reviewStorageKey]);

  const keepItem = useCallback(() => {
    if (!currentItem) return;

    setActionState('idle');
    setReviewState((state) => {
      const isPending = state.pendingIds.includes(currentItem.id);
      const keptItemIds = new Set(state.keptItemIds).add(currentItem.id);
      return {
        pendingIds: isPending ? removeId(state.pendingIds, currentItem.id) : state.pendingIds,
        revisitIds: isPending
          ? appendId(state.revisitIds, currentItem.id)
          : removeId(state.revisitIds, currentItem.id),
        keptItemIds,
      };
    });
  }, [currentItem]);

  const deleteItem = useCallback(async () => {
    if (!currentItem || actionState === 'deleting') return;

    setActionState('deleting');
    try {
      await deleteFeedItemById(currentItem.id, credentials);
      setDeletedItemIds((ids) => new Set(ids).add(currentItem.id));
      setReviewState((state) => {
        const keptItemIds = new Set(state.keptItemIds);
        keptItemIds.delete(currentItem.id);
        return {
          pendingIds: removeId(state.pendingIds, currentItem.id),
          revisitIds: removeId(state.revisitIds, currentItem.id),
          keptItemIds,
        };
      });
      setActionState('idle');
    } catch {
      setActionState('error');
    }
  }, [actionState, credentials, currentItem]);

  const retryLoad = useCallback(() => {
    setReviewState(createReviewState(reviewableIds));
    setActionState('idle');
    retry();
  }, [retry, reviewableIds]);

  return {
    items: items ?? [],
    currentItem,
    isLoading,
    isDeleting: actionState === 'deleting',
    loadFailed: status === 'error',
    deleteFailed: actionState === 'error',
    remainingCount: activeReviewIds.length,
    keepItem,
    deleteItem,
    retryLoad,
  };
}

function createReviewState(ids: number[]): ReviewState {
  return {
    pendingIds: ids,
    revisitIds: [],
    keptItemIds: new Set(),
  };
}

function removeId(ids: number[], id: number): number[] {
  return ids.filter((candidate) => candidate !== id);
}

function appendId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id];
}

function readReviewState(storageKey: string | null, availableIds: number[]): ReviewState | null {
  const storage = getReviewStorage();
  if (!storageKey || !storage) return null;

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) return null;
    const parsed: unknown = JSON.parse(rawValue);
    if (getObjectProperty(parsed, 'version') !== 1) return null;

    const pendingIds = parseIds(getObjectProperty(parsed, 'pendingIds'));
    const revisitIds = parseIds(getObjectProperty(parsed, 'revisitIds'));
    const keptIds = parseIds(getObjectProperty(parsed, 'keptItemIds'));
    if (!pendingIds || !revisitIds || !keptIds) return null;

    const available = new Set(availableIds);
    const keptItemIds = new Set(keptIds.filter((id) => available.has(id)));
    const filteredPendingIds = uniqueIds(
      pendingIds.filter((id) => available.has(id) && !keptItemIds.has(id)),
    );
    const filteredRevisitIds = uniqueIds(
      revisitIds.filter((id) => available.has(id) && keptItemIds.has(id)),
    );
    const knownIds = new Set([
      ...filteredPendingIds,
      ...filteredRevisitIds,
      ...keptItemIds,
    ]);
    const newIds = availableIds.filter((id) => !knownIds.has(id));

    return {
      pendingIds: [...filteredPendingIds, ...newIds],
      revisitIds: filteredRevisitIds,
      keptItemIds,
    };
  } catch {
    return null;
  }
}

function writeReviewState(storageKey: string | null, state: ReviewState): void {
  const storage = getReviewStorage();
  if (!storageKey || !storage) return;

  try {
    storage.setItem(storageKey, JSON.stringify({
      version: 1,
      pendingIds: state.pendingIds,
      revisitIds: state.revisitIds,
      keptItemIds: [...state.keptItemIds],
    }));
  } catch {
    // Keep the current review session usable if storage is unavailable.
  }
}

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return uniqueIds(value.filter(isSafeId));
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function isSafeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function getReviewStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
