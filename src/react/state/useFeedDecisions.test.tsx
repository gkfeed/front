// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFeedDecisionsStorageKey, useFeedDecisions } from './useFeedDecisions';
import { stubLocalStorage } from '../testUtils';

beforeEach(stubLocalStorage);

describe('useFeedDecisions', () => {
  it('starts empty without a username and records nothing', () => {
    const { result, rerender } = renderHook(({ username }) => useFeedDecisions(username), {
      initialProps: { username: null as string | null },
    });

    expect(result.current.decisions).toEqual([]);
    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));
    expect(result.current.decisions).toEqual([]);
    rerender({ username: 'reader' });
    expect(result.current.decisions).toEqual([]);
  });

  it('records decisions and persists them per user', async () => {
    const storage = stubLocalStorage();
    const { result, rerender } = renderHook(({ username }) => useFeedDecisions(username), {
      initialProps: { username: 'reader' as string | null },
    });

    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));
    const key = getFeedDecisionsStorageKey('reader');
    await waitFor(() => expect(JSON.parse(storage.get(key) ?? '[]')).toEqual([
      { itemId: 1, feedId: 2, kept: true },
    ]));

    rerender({ username: 'other' });
    expect(result.current.decisions).toEqual([]);
    rerender({ username: 'reader' });
    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);
  });

  it('rereads storage when the username changes mid-session', () => {
    const storage = stubLocalStorage();
    const readerKey = getFeedDecisionsStorageKey('reader');
    const otherKey = getFeedDecisionsStorageKey('other');
    storage.set(readerKey, JSON.stringify([{ itemId: 1, feedId: 2, kept: true }]));
    storage.set(otherKey, JSON.stringify([{ itemId: 3, feedId: 4, kept: false }]));

    const { result, rerender } = renderHook(({ username }) => useFeedDecisions(username), {
      initialProps: { username: 'reader' as string | null },
    });
    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);

    rerender({ username: 'other' });
    expect(result.current.decisions).toEqual([{ itemId: 3, feedId: 4, kept: false }]);
  });

  it('ignores malformed saved data and keeps the stored value untouched', () => {
    const storage = stubLocalStorage();
    storage.set(getFeedDecisionsStorageKey('reader'), '{"not":"an array"}');

    const { result } = renderHook(() => useFeedDecisions('reader'));

    expect(result.current.decisions).toEqual([]);
    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));
    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);
  });

  it('keeps recording when storage writes fail', () => {
    stubLocalStorage();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useFeedDecisions('reader'));
    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));

    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);
  });
});
