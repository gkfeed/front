import type { FeedItem } from '../types';
import {
  createReviewQueueState,
  reviewQueueReducer,
  type ReviewQueueAction,
  type ReviewQueueState,
} from './reviewQueue';

export type ReviewSessionState = {
  phase: 'idle' | 'ready';
  queue: ReviewQueueState;
  queueToPersist: ReviewQueueState | null;
  loadedItems: FeedItem[] | undefined;
  storageKey: string | null | undefined;
  isSyncComplete: boolean | undefined;
  orderKey: string | undefined;
  restoredSession: boolean;
  restoredIds: ReadonlySet<number>;
  pinnedCurrentId: number | undefined;
  skipNextPin: boolean;
};

export type ReviewSessionEvent =
  | {
    type: 'inputsChanged';
    loadedItems: FeedItem[] | undefined;
    storageKey: string | null;
    isSyncComplete: boolean;
    orderKey: string;
    reviewableIds: number[];
    restoredState: ReviewQueueState | null;
  }
  | { type: 'pinCurrent'; id: number | undefined }
  | { type: 'keep'; id: number }
  | { type: 'remove'; id: number }
  | { type: 'reset'; ids: number[] }
  | { type: 'persistenceCompleted' };

export function createReviewSessionState(): ReviewSessionState {
  return {
    phase: 'idle',
    queue: createReviewQueueState([]),
    queueToPersist: null,
    loadedItems: undefined,
    storageKey: undefined,
    isSyncComplete: undefined,
    orderKey: undefined,
    restoredSession: false,
    restoredIds: new Set(),
    pinnedCurrentId: undefined,
    skipNextPin: false,
  };
}

export function reviewSessionReducer(
  state: ReviewSessionState,
  event: ReviewSessionEvent,
): ReviewSessionState {
  switch (event.type) {
    case 'inputsChanged':
      return reduceInputsChanged(state, event);
    case 'pinCurrent':
      if (state.skipNextPin) return { ...state, skipNextPin: false };
      if (state.pinnedCurrentId === event.id) return state;
      return { ...state, pinnedCurrentId: event.id };
    case 'keep':
    case 'remove':
      return updateQueue(state, event, true);
    case 'reset':
      return updateQueue(state, event, true);
    case 'persistenceCompleted':
      return state.queueToPersist === null ? state : { ...state, queueToPersist: null };
  }
}

function reduceInputsChanged(
  state: ReviewSessionState,
  event: Extract<ReviewSessionEvent, { type: 'inputsChanged' }>,
): ReviewSessionState {
  if (event.loadedItems === undefined) {
    return state.phase === 'idle' ? state : createReviewSessionState();
  }
  if (
    event.loadedItems === state.loadedItems
    && event.storageKey === state.storageKey
    && event.isSyncComplete === state.isSyncComplete
    && event.orderKey === state.orderKey
  ) return state;

  const isInitialLoad = state.phase === 'idle' || event.storageKey !== state.storageKey;
  const orderChanged = state.orderKey !== undefined && event.orderKey !== state.orderKey;
  const base = {
    ...state,
    phase: 'ready' as const,
    loadedItems: event.loadedItems,
    storageKey: event.storageKey,
    isSyncComplete: event.isSyncComplete,
    orderKey: event.orderKey,
  };

  if (isInitialLoad) {
    const restoredSession = event.restoredState !== null;
    const restoredIds = new Set(event.restoredState ? [
      ...event.restoredState.pendingIds,
      ...event.restoredState.revisitIds,
      ...event.restoredState.keptItemIds,
    ] : []);
    let queue = event.restoredState ?? createReviewQueueState(event.reviewableIds);
    if (event.restoredState && event.isSyncComplete) {
      queue = reviewQueueReducer(queue, { type: 'reconcile', ids: event.reviewableIds });
    } else if (event.restoredState) {
      queue = reviewQueueReducer(queue, {
        type: 'extendRestored',
        ids: event.reviewableIds,
        restoredIds,
      });
    }
    return {
      ...base,
      queue,
      queueToPersist: event.isSyncComplete ? queue : null,
      restoredSession,
      restoredIds,
      pinnedCurrentId: undefined,
      skipNextPin: false,
    };
  }

  if (orderChanged) {
    const queue = reviewQueueReducer(state.queue, { type: 'reorder', ids: event.reviewableIds });
    return {
      ...base,
      queue,
      queueToPersist: queue,
      pinnedCurrentId: undefined,
      skipNextPin: true,
    };
  }

  if (event.isSyncComplete) {
    const queue = reviewQueueReducer(state.queue, {
      type: 'reconcile',
      ids: event.reviewableIds,
    });
    return {
      ...base,
      queue,
      queueToPersist: queue,
      pinnedCurrentId: state.restoredSession ? undefined : state.pinnedCurrentId,
    };
  }

  const queueAction: ReviewQueueAction = state.restoredSession
    ? { type: 'extendRestored', ids: event.reviewableIds, restoredIds: state.restoredIds }
    : { type: 'extend', ids: event.reviewableIds };
  return { ...base, queue: reviewQueueReducer(state.queue, queueAction) };
}

function updateQueue(
  state: ReviewSessionState,
  action: Extract<ReviewQueueAction, { type: 'keep' | 'remove' | 'reset' }>,
  clearPin: boolean,
): ReviewSessionState {
  const queue = reviewQueueReducer(state.queue, action);
  return {
    ...state,
    queue,
    queueToPersist: queue,
    pinnedCurrentId: clearPin ? undefined : state.pinnedCurrentId,
  };
}
