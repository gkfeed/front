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

  it('merges interleaved writers without restoring stale decisions', () => {
    const first = { itemId: 1, feedId: 2, kept: true };
    const second = { itemId: 2, feedId: 3, kept: true };
    const changed = { ...first, kept: false };
    const third = { itemId: 3, feedId: 4, kept: true };
    const key = getFeedDecisionsStorageKey('reader');
    const { result: left } = renderHook(() => useFeedDecisions('reader'));
    const { result: right } = renderHook(() => useFeedDecisions('reader'));

    act(() => left.current.recordDecision(first));
    act(() => right.current.recordDecision(second));
    expect(right.current.decisions).toEqual([first, second]);

    act(() => left.current.recordDecision(changed));
    act(() => right.current.recordDecision(third));

    expect(right.current.decisions).toEqual([second, changed, third]);
    expect(JSON.parse(storage.get(key)!)).toEqual([second, changed, third]);
  });

  it('retries pending decisions after a failed write without losing other writers', () => {
    const first = { itemId: 1, feedId: 2, kept: true };
    const second = { itemId: 2, feedId: 3, kept: false };
    const third = { itemId: 3, feedId: 4, kept: true };
    const key = getFeedDecisionsStorageKey('reader');
    const { result: left } = renderHook(() => useFeedDecisions('reader'));
    const { result: right } = renderHook(() => useFeedDecisions('reader'));
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    act(() => left.current.recordDecision(first));
    act(() => right.current.recordDecision(second));
    act(() => left.current.recordDecision(third));

    expect(left.current.decisions).toEqual([second, first, third]);
    expect(JSON.parse(storage.get(key)!)).toEqual([second, first, third]);
  });

  it('preserves loaded history when a later storage read fails', () => {
    const first = { itemId: 1, feedId: 2, kept: true };
    const second = { itemId: 2, feedId: 3, kept: false };
    const key = getFeedDecisionsStorageKey('reader');
    storage.set(key, JSON.stringify([first]));
    const { result } = renderHook(() => useFeedDecisions('reader'));
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    act(() => result.current.recordDecision(second));

    expect(result.current.decisions).toEqual([first, second]);
    expect(JSON.parse(storage.get(key)!)).toEqual([first, second]);
  });

  it('ignores callbacks from a previous user', () => {
    const { result, rerender } = renderHook(({ username }) => useFeedDecisions(username), {
      initialProps: { username: 'reader' },
    });
    const recordDecision = result.current.recordDecision;
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    rerender({ username: 'other' });

    act(() => recordDecision({ itemId: 1, feedId: 2, kept: true }));

    expect(result.current.decisions).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
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
