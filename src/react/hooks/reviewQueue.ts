export type ReviewQueueState = {
  pendingIds: number[];
  revisitIds: number[];
  keptItemIds: Set<number>;
};

export type ReviewQueueAction =
  | { type: 'restore'; state: ReviewQueueState }
  | { type: 'reset'; ids: number[] }
  | { type: 'extend'; ids: number[] }
  | { type: 'extendRestored'; ids: number[]; restoredIds: ReadonlySet<number> }
  | { type: 'reconcile'; ids: number[] }
  | { type: 'keep'; id: number }
  | { type: 'remove'; id: number };

export function createReviewQueueState(ids: number[]): ReviewQueueState {
  return {
    pendingIds: [...ids],
    revisitIds: [],
    keptItemIds: new Set(),
  };
}

export function reviewQueueReducer(
  state: ReviewQueueState,
  action: ReviewQueueAction,
): ReviewQueueState {
  switch (action.type) {
    case 'restore':
      return cloneReviewQueueState(action.state);
    case 'reset':
      return createReviewQueueState(action.ids);
    case 'extend': {
      const knownIds = new Set([
        ...state.pendingIds,
        ...state.revisitIds,
        ...state.keptItemIds,
      ]);
      const newIds = action.ids.filter((id) => !knownIds.has(id));
      return {
        ...state,
        pendingIds: [...state.pendingIds, ...newIds],
      };
    }
    case 'extendRestored': {
      const knownIds = new Set([
        ...state.pendingIds,
        ...state.revisitIds,
        ...state.keptItemIds,
      ]);
      const newIds = action.ids.filter((id) => !knownIds.has(id));
      const firstRestoredIndex = state.pendingIds.findIndex((id) => action.restoredIds.has(id));
      const insertionIndex = firstRestoredIndex === -1
        ? state.pendingIds.length
        : firstRestoredIndex;
      return {
        ...state,
        pendingIds: [
          ...state.pendingIds.slice(0, insertionIndex),
          ...newIds,
          ...state.pendingIds.slice(insertionIndex),
        ],
      };
    }
    case 'reconcile': {
      const availableIds = new Set(action.ids);
      const keptItemIds = new Set([...state.keptItemIds].filter((id) => availableIds.has(id)));
      const pendingIds = state.pendingIds.filter((id) => availableIds.has(id));
      const revisitIds = state.revisitIds.filter((id) => availableIds.has(id));
      const knownIds = new Set([...pendingIds, ...revisitIds, ...keptItemIds]);
      const newIds = action.ids
        .filter((id) => !knownIds.has(id))
        .sort((left, right) => right - left);
      return {
        pendingIds: [...newIds, ...pendingIds],
        revisitIds,
        keptItemIds,
      };
    }
    case 'keep': {
      const isPending = state.pendingIds.includes(action.id);
      const keptItemIds = new Set(state.keptItemIds).add(action.id);
      return {
        pendingIds: isPending ? removeId(state.pendingIds, action.id) : state.pendingIds,
        revisitIds: isPending
          ? appendId(state.revisitIds, action.id)
          : removeId(state.revisitIds, action.id),
        keptItemIds,
      };
    }
    case 'remove': {
      const keptItemIds = new Set(state.keptItemIds);
      keptItemIds.delete(action.id);
      return {
        pendingIds: removeId(state.pendingIds, action.id),
        revisitIds: removeId(state.revisitIds, action.id),
        keptItemIds,
      };
    }
  }
}

export function getActiveReviewIds(
  state: ReviewQueueState,
  visibleItemIds: ReadonlySet<number>,
): number[] {
  const pendingIds = state.pendingIds.filter((id) => visibleItemIds.has(id));
  if (pendingIds.length > 0) return pendingIds;
  return state.revisitIds.filter((id) => visibleItemIds.has(id));
}

function cloneReviewQueueState(state: ReviewQueueState): ReviewQueueState {
  return {
    pendingIds: [...state.pendingIds],
    revisitIds: [...state.revisitIds],
    keptItemIds: new Set(state.keptItemIds),
  };
}

function removeId(ids: number[], id: number): number[] {
  return ids.filter((candidate) => candidate !== id);
}

function appendId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id];
}
