// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { getReviewStateStorageKey, readReviewItemOrder, readReviewState, writeReviewState } from './reviewStateStorage';
import { createReviewSessionState, getActiveReviewIds, reviewSessionReducer } from './reviewSession';

afterEach(restoreLocalStorage);

describe('reviewStateStorage', () => {
  it('persists the queue order and accepts legacy progress without order metadata', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const progress = { pendingIds: [2, 1], revisitIds: [], keptItemIds: new Set<number>() };
    writeReviewState(key, progress, 'desc');
    expect(readReviewItemOrder(key)).toBe('desc');
    expect(readReviewState(key)).toEqual(progress);
    writeReviewState(key, progress);
    expect(readReviewItemOrder(key)).toBeNull();
    expect(readReviewState(key)).toEqual(progress);
  });

  it('restores an active revisit after a background refresh and reload', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const presentation = { itemOrder: 'desc', nsfwMode: 'show', hideTikTokItems: false, feedPriorities: {} } as const;
    const item = { id: 1, feedId: 1, link: 'https://example.com/1', title: 'Item 1', text: '' };
    let state = reviewSessionReducer(createReviewSessionState(presentation), {
      type: 'sessionChanged', storageKey: key, restoredProgress: null,
    });
    state = reviewSessionReducer(state, { type: 'snapshotChanged', items: [item], isComplete: true });
    state = reviewSessionReducer(state, { type: 'keep', id: item.id });
    state = reviewSessionReducer(state, { type: 'snapshotChanged', items: [item], isComplete: true });
    writeReviewState(key, state.progress);

    state = reviewSessionReducer(createReviewSessionState(presentation), {
      type: 'sessionChanged', storageKey: key, restoredProgress: readReviewState(key),
    });
    state = reviewSessionReducer(state, { type: 'snapshotChanged', items: [item], isComplete: true });
    expect(getActiveReviewIds(state)).toEqual([item.id]);
  });

  it('uses a separate storage key for each user', () => {
    expect(getReviewStateStorageKey('reader')).not.toBe(getReviewStateStorageKey('other'));
  });

  it('persists and restores review progress without an item snapshot', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const state = {
      pendingIds: [3],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    };

    writeReviewState(key, state);

    expect(readReviewState(key)).toEqual({
      pendingIds: [3],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    });
  });

  it('does not discard saved ids that have not been fetched yet', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const state = {
      pendingIds: [4, 3, 1],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    };

    writeReviewState(key, state);

    expect(readReviewState(key)).toEqual({
      pendingIds: [4, 3, 1],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    });
  });

  it('ignores malformed persisted data', () => {
    const values = stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    values.set(key, JSON.stringify({ version: 1, pendingIds: 'invalid' }));

    expect(readReviewState(key)).toBeNull();
  });
});
