import { isNsfwLink } from '../domain/nsfw';
import { isTikTokFeedItem } from '../domain/feedItemProviderPresentation';
import type { NsfwMode } from '../domain/feedItemCardContracts';
import { orderFeedItems, type FeedPriorities } from '../state/feedPriority';
import type { ReaderItemOrder } from '../state/readerItemOrder';
import type { FeedItem } from '../types';

export type ReviewProgress = {
  pendingIds: number[];
  revisitIds: number[];
  keptItemIds: Set<number>;
};

export type ReviewPresentation = {
  itemOrder: ReaderItemOrder;
  nsfwMode: NsfwMode;
  hideTikTokItems: boolean;
  feedPriorities: FeedPriorities;
};

export type FeedItemDeletion = {
  itemId: number;
  title: string;
  operationId: number;
  attempt: 1 | 2;
  status: 'pending' | 'failed' | 'deleted';
};

export type ReviewSessionState = {
  storageKey: string | null | undefined;
  snapshot: FeedItem[] | undefined;
  isSyncComplete: boolean;
  presentation: ReviewPresentation;
  items: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: Set<number>;
  progress: ReviewProgress;
  deletions: FeedItemDeletion[];
  nextDeletionOperationId: number;
  hasProgress: boolean;
  progressToPersist: ReviewProgress | null;
};

export type ReviewSessionEvent =
  | { type: 'sessionChanged'; storageKey: string | null; restoredProgress: ReviewProgress | null }
  | { type: 'snapshotChanged'; items: FeedItem[] | undefined; isComplete: boolean }
  | { type: 'presentationChanged'; presentation: ReviewPresentation }
  | { type: 'keep'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'delete'; id: number; title: string }
  | { type: 'deletionSucceeded'; id: number; operationId: number }
  | { type: 'deletionFailed'; id: number; operationId: number }
  | { type: 'recoverDeletion'; id: number }
  | { type: 'reset'; ids?: number[] }
  | { type: 'persistenceCompleted'; progress: ReviewProgress };

export function createReviewSessionState(presentation: ReviewPresentation): ReviewSessionState {
  return {
    storageKey: undefined,
    snapshot: undefined,
    isSyncComplete: false,
    presentation,
    items: undefined,
    reviewableIds: [],
    visibleItemIds: new Set(),
    progress: createProgress([]),
    deletions: [],
    nextDeletionOperationId: 1,
    hasProgress: false,
    progressToPersist: null,
  };
}

export function reviewSessionReducer(
  state: ReviewSessionState,
  event: ReviewSessionEvent,
): ReviewSessionState {
  switch (event.type) {
    case 'sessionChanged': {
      if (event.storageKey === state.storageKey) return state;
      const progress = event.restoredProgress ?? createProgress([]);
      return {
        ...state,
        storageKey: event.storageKey,
        snapshot: undefined,
        isSyncComplete: false,
        items: undefined,
        reviewableIds: [],
        visibleItemIds: new Set(),
        progress,
        deletions: [],
        hasProgress: event.restoredProgress !== null,
        progressToPersist: null,
      };
    }
    case 'snapshotChanged':
      return reduceSnapshotChanged(state, event.items, event.isComplete);
    case 'presentationChanged':
      return reducePresentationChanged(state, event.presentation);
    case 'keep':
      return updateProgress(state, keepItem(state.progress, event.id));
    case 'remove':
      return updateProgress(state, removeItem(state.progress, event.id));
    case 'delete':
      return reduceDelete(state, event.id, event.title);
    case 'deletionSucceeded':
      return updateDeletion(state, event.id, event.operationId, (deletion) => ({
        ...deletion,
        status: 'deleted',
      }));
    case 'deletionFailed':
      return updateDeletion(state, event.id, event.operationId, (deletion) => (
        deletion.attempt === 1
          ? { ...deletion, attempt: 2, status: 'pending' }
          : { ...deletion, status: 'failed' }
      ));
    case 'recoverDeletion':
      return reduceRecoverDeletion(state, event.id);
    case 'reset':
      return updateProgress(state, createProgress(event.ids ?? state.reviewableIds));
    case 'persistenceCompleted':
      return state.progressToPersist !== event.progress
        ? state
        : { ...state, progressToPersist: null };
  }
}

export function getActiveReviewIds(state: ReviewSessionState): number[] {
  const pendingIds = state.progress.pendingIds.filter((id) => state.visibleItemIds.has(id));
  if (pendingIds.length > 0) return pendingIds;
  return state.progress.revisitIds.filter((id) => state.visibleItemIds.has(id));
}

function reduceSnapshotChanged(
  state: ReviewSessionState,
  incomingItems: FeedItem[] | undefined,
  isComplete: boolean,
): ReviewSessionState {
  // A reload starts by clearing the I/O hook. Keep the committed session usable
  // until the replacement snapshot begins to arrive.
  if (incomingItems === undefined) return state;

  const snapshot = isComplete
    ? [...incomingItems]
    : mergePartialSnapshot(state.snapshot, incomingItems);
  const deletions = isComplete
    ? reconcileDeletions(state.deletions, snapshot)
    : state.deletions;
  const projection = projectSnapshot(snapshot, state.presentation, deletions);

  if (isComplete) {
    const progress = state.hasProgress
      ? reconcileProgress(state.progress, projection.reviewableIds)
      : createProgress(projection.reviewableIds);
    return {
      ...state,
      snapshot,
      isSyncComplete: true,
      ...projection,
      deletions,
      progress,
      hasProgress: true,
      progressToPersist: progress,
    };
  }

  if (state.hasProgress) {
    return { ...state, snapshot, isSyncComplete: false, deletions, ...projection };
  }

  // The first partial page starts the initial session. Later partial pages are
  // data updates only and cannot insert cards into the active review queue.
  const progress = createProgress(projection.reviewableIds);
  return {
    ...state,
    snapshot,
    isSyncComplete: false,
    ...projection,
    deletions,
    progress,
    hasProgress: true,
  };
}

function reducePresentationChanged(
  state: ReviewSessionState,
  presentation: ReviewPresentation,
): ReviewSessionState {
  const orderChanged = presentation.itemOrder !== state.presentation.itemOrder
    || !prioritiesEqual(presentation.feedPriorities, state.presentation.feedPriorities);
  const projection = projectSnapshot(state.snapshot, presentation, state.deletions);
  if (!orderChanged) return { ...state, presentation, ...projection };

  const progress = reorderProgress(state.progress, projection.reviewableIds);
  return {
    ...state,
    presentation,
    ...projection,
    progress,
    progressToPersist: state.hasProgress ? progress : null,
  };
}

function projectSnapshot(
  snapshot: FeedItem[] | undefined,
  presentation: ReviewPresentation,
  deletions: FeedItemDeletion[],
): Pick<ReviewSessionState, 'items' | 'reviewableIds' | 'visibleItemIds'> {
  if (!snapshot) return { items: undefined, reviewableIds: [], visibleItemIds: new Set() };

  const orderedItems = orderFeedItems(snapshot, presentation.itemOrder, presentation.feedPriorities);
  const deletedItemIds = new Set(deletions.map(({ itemId }) => itemId));
  const availableItems = orderedItems.filter((item) => !deletedItemIds.has(item.id));
  const items = availableItems.filter((item) => (
    (presentation.nsfwMode !== 'hide' || !isNsfwLink(item.link))
    && (!presentation.hideTikTokItems || !isTikTokFeedItem(item))
  ));
  const availableIds = availableItems.map((item) => item.id);

  return {
    items,
    reviewableIds: availableIds,
    visibleItemIds: new Set(items.map((item) => item.id)),
  };
}

function reduceDelete(state: ReviewSessionState, id: number, title: string): ReviewSessionState {
  if (state.deletions.some((deletion) => deletion.itemId === id)) return state;

  const deletion: FeedItemDeletion = {
    itemId: id,
    title,
    operationId: state.nextDeletionOperationId,
    attempt: 1,
    status: 'pending',
  };
  const deletions = [...state.deletions, deletion];
  const progress = removeItem(state.progress, id);
  return {
    ...state,
    ...projectSnapshot(state.snapshot, state.presentation, deletions),
    deletions,
    nextDeletionOperationId: state.nextDeletionOperationId + 1,
    progress,
    hasProgress: true,
    progressToPersist: progress,
  };
}

function updateDeletion(
  state: ReviewSessionState,
  id: number,
  operationId: number,
  update: (deletion: FeedItemDeletion) => FeedItemDeletion,
): ReviewSessionState {
  const index = state.deletions.findIndex((deletion) => (
    deletion.itemId === id && deletion.operationId === operationId && deletion.status === 'pending'
  ));
  if (index === -1) return state;
  const deletions = [...state.deletions];
  deletions[index] = update(deletions[index]);
  return { ...state, deletions };
}

function reduceRecoverDeletion(state: ReviewSessionState, id: number): ReviewSessionState {
  const deletion = state.deletions.find((candidate) => candidate.itemId === id);
  if (deletion?.status !== 'failed') return state;

  const deletions = state.deletions.filter((candidate) => candidate !== deletion);
  const progress = restoreAsCurrent(state.progress, id);
  return {
    ...state,
    ...projectSnapshot(state.snapshot, state.presentation, deletions),
    deletions,
    progress,
    hasProgress: true,
    progressToPersist: progress,
  };
}

function reconcileDeletions(deletions: FeedItemDeletion[], snapshot: FeedItem[]): FeedItemDeletion[] {
  const serverIds = new Set(snapshot.map(({ id }) => id));
  return deletions.filter((deletion) => deletion.status !== 'failed' && serverIds.has(deletion.itemId));
}

function restoreAsCurrent(progress: ReviewProgress, id: number): ReviewProgress {
  const keptItemIds = new Set(progress.keptItemIds);
  keptItemIds.delete(id);
  return {
    pendingIds: [id, ...removeId(progress.pendingIds, id)],
    revisitIds: removeId(progress.revisitIds, id),
    keptItemIds,
  };
}

function createProgress(ids: number[]): ReviewProgress {
  return { pendingIds: [...ids], revisitIds: [], keptItemIds: new Set() };
}

function updateProgress(state: ReviewSessionState, progress: ReviewProgress): ReviewSessionState {
  return { ...state, progress, hasProgress: true, progressToPersist: progress };
}

function keepItem(progress: ReviewProgress, id: number): ReviewProgress {
  const isPending = progress.pendingIds.includes(id);
  return {
    pendingIds: isPending ? removeId(progress.pendingIds, id) : progress.pendingIds,
    revisitIds: isPending
      ? appendId(progress.revisitIds, id)
      : removeId(progress.revisitIds, id),
    keptItemIds: new Set(progress.keptItemIds).add(id),
  };
}

function removeItem(progress: ReviewProgress, id: number): ReviewProgress {
  const keptItemIds = new Set(progress.keptItemIds);
  keptItemIds.delete(id);
  return {
    pendingIds: removeId(progress.pendingIds, id),
    revisitIds: removeId(progress.revisitIds, id),
    keptItemIds,
  };
}

function reconcileProgress(progress: ReviewProgress, orderedIds: number[]): ReviewProgress {
  const availableIds = new Set(orderedIds);
  const keptItemIds = new Set([...progress.keptItemIds].filter((id) => availableIds.has(id)));
  const pendingIds = new Set(progress.pendingIds.filter((id) => availableIds.has(id)));
  const revisitIds = new Set(progress.revisitIds.filter((id) => availableIds.has(id)));
  const knownIds = new Set([...pendingIds, ...revisitIds, ...keptItemIds]);
  return {
    pendingIds: orderedIds.filter((id) => pendingIds.has(id) || !knownIds.has(id)),
    revisitIds: orderedIds.filter((id) => revisitIds.has(id)),
    keptItemIds,
  };
}

function reorderProgress(progress: ReviewProgress, orderedIds: number[]): ReviewProgress {
  return {
    pendingIds: orderKnownIds(progress.pendingIds, orderedIds),
    revisitIds: orderKnownIds(progress.revisitIds, orderedIds),
    keptItemIds: progress.keptItemIds,
  };
}

function orderKnownIds(currentIds: number[], orderedIds: number[]): number[] {
  const currentIdSet = new Set(currentIds);
  const availableIdSet = new Set(orderedIds);
  return [
    ...orderedIds.filter((id) => currentIdSet.has(id)),
    ...currentIds.filter((id) => !availableIdSet.has(id)),
  ];
}

function mergePartialSnapshot(
  currentItems: FeedItem[] | undefined,
  incomingItems: FeedItem[],
): FeedItem[] {
  if (!currentItems) return [...incomingItems];
  const incomingIds = new Set(incomingItems.map((item) => item.id));
  return [...incomingItems, ...currentItems.filter((item) => !incomingIds.has(item.id))];
}

function prioritiesEqual(left: FeedPriorities, right: FeedPriorities): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([feedId, priority]) => right[Number(feedId)] === priority);
}

function removeId(ids: number[], id: number): number[] {
  return ids.filter((candidate) => candidate !== id);
}

function appendId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id];
}
