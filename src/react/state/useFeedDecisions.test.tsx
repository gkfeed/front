// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFeedDecisionsStorageKey, useFeedDecisions } from './useFeedDecisions';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';

let storage: ReturnType<typeof stubLocalStorage>;

beforeEach(() => {
  storage = stubLocalStorage();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  restoreLocalStorage();
});

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

  it.each(['{"not":"an array"}', '{invalid json'])('leaves malformed data %s untouched until a decision changes', (saved) => {
    const key = getFeedDecisionsStorageKey('reader');
    storage.set(key, saved);

    const { result } = renderHook(() => useFeedDecisions('reader'));

    expect(result.current.decisions).toEqual([]);
    expect(storage.get(key)).toBe(saved);
    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));
    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);
    expect(JSON.parse(storage.get(key)!)).toEqual(result.current.decisions);
  });

  it('does not write on mount, unchanged decisions, or user switches', () => {
    const decision = { itemId: 1, feedId: 2, kept: true };
    storage.set(getFeedDecisionsStorageKey('reader'), JSON.stringify([decision]));
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { result, rerender } = renderHook(({ username }) => useFeedDecisions(username), {
      initialProps: { username: 'reader' as string | null },
    });

    act(() => result.current.recordDecision(decision));
    expect(setItem).not.toHaveBeenCalled();

    act(() => result.current.recordDecision({ ...decision, kept: false }));
    expect(setItem).toHaveBeenCalledTimes(1);
    act(() => result.current.recordDecision({ ...decision, kept: false }));
    expect(setItem).toHaveBeenCalledTimes(1);

    rerender({ username: 'other' });
    rerender({ username: null });
    rerender({ username: 'reader' });
    expect(result.current.decisions).toEqual([{ ...decision, kept: false }]);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps recording when storage writes fail', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useFeedDecisions('reader'));
    act(() => result.current.recordDecision({ itemId: 1, feedId: 2, kept: true }));

    expect(result.current.decisions).toEqual([{ itemId: 1, feedId: 2, kept: true }]);
  });
});
