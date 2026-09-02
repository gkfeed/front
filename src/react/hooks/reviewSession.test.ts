import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import {
  createReviewSessionState,
  getActiveReviewIds,
  reviewSessionReducer,
  type ReviewPresentation,
  type ReviewProgress,
  type ReviewSessionState,
} from './reviewSession';

const presentation: ReviewPresentation = {
  itemOrder: 'desc',
  nsfwMode: 'show',
  hideTikTokItems: false,
  deletedItemIds: new Set(),
  requeuedItemIds: new Set(),
  feedPriorities: {},
};

describe('review session', () => {
  it('restores progress and waits for a completed reload before adding new cards', () => {
    let state = startSession({
      pendingIds: [3, 2],
      revisitIds: [1],
      keptItemIds: new Set([1]),
    });
    state = snapshot(state, [3, 2, 1], true);

    state = reviewSessionReducer(state, {
      type: 'snapshotChanged',
      items: undefined,
      isComplete: false,
    });
    state = snapshot(state, [5, 4, 3], false);

    expect(getActiveReviewIds(state)).toEqual([3, 2]);
    expect(state.progress).toEqual({
      pendingIds: [3, 2],
      revisitIds: [1],
      keptItemIds: new Set([1]),
    });

    state = snapshot(state, [5, 4, 3], true);

    expect(getActiveReviewIds(state)).toEqual([5, 4, 3]);
    expect(state.progress).toEqual({
      pendingIds: [5, 4, 3],
      revisitIds: [],
      keptItemIds: new Set(),
    });
  });

  it('keeps review decisions when a fresh snapshot adds cards', () => {
    let state = startSession(null);
    state = snapshot(state, [3, 2, 1], true);
    state = reviewSessionReducer(state, { type: 'keep', id: 3 });
    state = reviewSessionReducer(state, { type: 'remove', id: 2 });

    state = snapshot(state, [5, 4, 3, 2, 1], true);

    expect(state.progress).toEqual({
      pendingIds: [5, 4, 2, 1],
      revisitIds: [3],
      keptItemIds: new Set([3]),
    });
  });

  it('reset restores every card from the current snapshot without loading data', () => {
    let state = startSession(null);
    state = snapshot(state, [3, 2, 1], true);
    const committedSnapshot = state.snapshot;
    state = reviewSessionReducer(state, { type: 'keep', id: 3 });
    state = reviewSessionReducer(state, { type: 'remove', id: 2 });

    state = reviewSessionReducer(state, { type: 'reset' });

    expect(state.snapshot).toBe(committedSnapshot);
    expect(getActiveReviewIds(state)).toEqual([3, 2, 1]);
    expect(state.progress).toEqual({
      pendingIds: [3, 2, 1],
      revisitIds: [],
      keptItemIds: new Set(),
    });
  });

  it('an order or priority change reorders only the remaining queues', () => {
    let state = startSession(null);
    state = snapshot(state, [4, 3, 2, 1], true);
    state = reviewSessionReducer(state, { type: 'remove', id: 4 });
    state = reviewSessionReducer(state, { type: 'keep', id: 3 });

    state = reviewSessionReducer(state, {
      type: 'presentationChanged',
      presentation: { ...presentation, itemOrder: 'asc' },
    });

    expect(state.progress).toEqual({
      pendingIds: [1, 2],
      revisitIds: [3],
      keptItemIds: new Set([3]),
    });
    expect(state.progress.pendingIds).not.toContain(4);

    state = reviewSessionReducer(state, {
      type: 'presentationChanged',
      presentation: { ...presentation, itemOrder: 'asc', feedPriorities: { 2: 1 } },
    });

    expect(state.progress.pendingIds).toEqual([2, 1]);
    expect(state.progress.revisitIds).toEqual([3]);
    expect(state.progress.keptItemIds).toEqual(new Set([3]));
  });

  it('projects visibility and deletion from the same committed snapshot', () => {
    let state = startSession(null);
    state = reviewSessionReducer(state, {
      type: 'presentationChanged',
      presentation: {
        ...presentation,
        nsfwMode: 'hide',
        hideTikTokItems: true,
        deletedItemIds: new Set([3]),
      },
    });
    state = reviewSessionReducer(state, {
      type: 'snapshotChanged',
      isComplete: true,
      items: [
        item(4, 'https://www.tiktok.com/@creator/video/123'),
        item(3),
        item(2, 'https://pornhub.com/video'),
        item(1),
      ],
    });

    expect(state.items?.map(({ id }) => id)).toEqual([1]);
    expect(state.reviewableIds).toEqual([4, 2, 1]);
    expect(getActiveReviewIds(state)).toEqual([1]);
  });
});

function startSession(restoredProgress: ReviewProgress | null): ReviewSessionState {
  return reviewSessionReducer(createReviewSessionState(presentation), {
    type: 'sessionChanged',
    storageKey: 'reader',
    restoredProgress,
  });
}

function snapshot(
  state: ReviewSessionState,
  ids: number[],
  isComplete: boolean,
): ReviewSessionState {
  return reviewSessionReducer(state, {
    type: 'snapshotChanged',
    items: ids.map((id) => item(id)),
    isComplete,
  });
}

function item(id: number, link = `https://example.com/${id}`): FeedItem {
  return { id, feedId: id, link, title: `Item ${id}`, text: '' };
}
