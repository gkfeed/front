import { describe, expect, it } from 'vitest';

import {
  createReviewQueueState,
  getActiveReviewIds,
  reviewQueueReducer,
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
});
