// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

afterEach(restoreLocalStorage);

describe('reviewStateStorage', () => {
  it('persists and restores a review queue while adding new items', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const state = {
      pendingIds: [3],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    };

    writeReviewState(key, state);

    expect(readReviewState(key, [1, 2, 3])).toEqual({
      pendingIds: [1, 3],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    });
  });

  it('puts the newest fetched items first regardless of API order', () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    const state = {
      pendingIds: [4, 3, 1],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    };

    writeReviewState(key, state);

    expect(readReviewState(key, [1, 5, 4, 3, 7, 2])).toEqual({
      pendingIds: [7, 5, 4, 3, 1],
      revisitIds: [2],
      keptItemIds: new Set([2]),
    });
  });

  it('ignores malformed persisted data', () => {
    const values = stubLocalStorage();
    const key = getReviewStateStorageKey('reader');
    values.set(key, JSON.stringify({ version: 1, pendingIds: 'invalid' }));

    expect(readReviewState(key, [1])).toBeNull();
  });
});
