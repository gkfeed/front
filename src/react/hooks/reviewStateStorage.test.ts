// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';

afterEach(restoreLocalStorage);

describe('reviewStateStorage', () => {
  it('persists and restores a review queue without an item snapshot', () => {
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
