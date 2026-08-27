import { describe, expect, it } from 'vitest';

import {
  createReviewQueueState,
  getActiveReviewIds,
  reviewQueueReducer,
  type ReviewQueueState,
} from './reviewQueue';

describe('reviewQueueReducer', () => {
  it('moves kept items to the revisit queue after pending items', () => {
    let state = createReviewQueueState([1, 2, 3]);

    state = reviewQueueReducer(state, { type: 'keep', id: 1 });
    state = reviewQueueReducer(state, { type: 'keep', id: 2 });
    state = reviewQueueReducer(state, { type: 'keep', id: 3 });

    expect(state.pendingIds).toEqual([]);
    expect(state.revisitIds).toEqual([1, 2, 3]);
    expect(getActiveReviewIds(state, new Set([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('removes an item from every queue without mutating the previous state', () => {
    const previous = {
      pendingIds: [1, 2],
      revisitIds: [3],
      keptItemIds: new Set([3]),
    };

    const next = reviewQueueReducer(previous, { type: 'remove', id: 3 });

    expect(next).toEqual({ pendingIds: [1, 2], revisitIds: [], keptItemIds: new Set() });
    expect(previous).toEqual({ pendingIds: [1, 2], revisitIds: [3], keptItemIds: new Set([3]) });
  });

  it('prefers pending visible items and ignores hidden ones', () => {
    const state = {
      pendingIds: [1, 2],
      revisitIds: [3],
      keptItemIds: new Set([3]),
    };

    expect(getActiveReviewIds(state, new Set([2, 3]))).toEqual([2]);
    expect(getActiveReviewIds({ ...state, pendingIds: [] }, new Set([2, 3]))).toEqual([3]);
  });

  it('appends cursor pages without resetting review progress', () => {
    let state = createReviewQueueState([10, 9]);
    state = reviewQueueReducer(state, { type: 'keep', id: 10 });

    state = reviewQueueReducer(state, { type: 'extend', ids: [10, 9, 8, 7] });

    expect(state).toEqual({
      pendingIds: [9, 8, 7],
      revisitIds: [10],
      keptItemIds: new Set([10]),
    });
  });

  it('does not move newly fetched ids ahead of the active cursor page', () => {
    const state = createReviewQueueState([10, 9]);

    const next = reviewQueueReducer(state, { type: 'extend', ids: [12, 11, 10, 9] });

    expect(next.pendingIds).toEqual([10, 9, 12, 11]);
  });

  it('extends partial snapshots before a saved queue without discarding unfetched ids', () => {
    const restoredIds = new Set([98, 96]);
    let state: ReviewQueueState = {
      pendingIds: [98, 96],
      revisitIds: [],
      keptItemIds: new Set<number>(),
    };

    state = reviewQueueReducer(state, {
      type: 'extendRestored',
      ids: [110, 109],
      restoredIds,
    });
    state = reviewQueueReducer(state, {
      type: 'extendRestored',
      ids: [110, 109, 108, 107],
      restoredIds,
    });

    expect(state.pendingIds).toEqual([110, 109, 108, 107, 98, 96]);
  });

  it('removes externally deleted ids after the authoritative sync completes', () => {
    const state = {
      pendingIds: [10, 9, 8],
      revisitIds: [7],
      keptItemIds: new Set([7]),
    };

    const next = reviewQueueReducer(state, { type: 'reconcile', ids: [11, 10, 8] });

    expect(next).toEqual({
      pendingIds: [11, 10, 8],
      revisitIds: [],
      keptItemIds: new Set(),
    });
  });
});
