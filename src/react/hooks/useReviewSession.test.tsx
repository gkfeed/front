// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import { getReviewStateStorageKey } from './reviewStateStorage';
import { useReviewSession } from './useReviewSession';

const loadedPage = [] as FeedItem[];

describe('useReviewSession', () => {
  const reviewStorage = new Map<string, string>();

  beforeEach(() => {
    reviewStorage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => reviewStorage.get(key) ?? null,
        removeItem: (key: string) => reviewStorage.delete(key),
        setItem: (key: string, value: string) => reviewStorage.set(key, value),
      },
    });
  });

  it('keeps the current item stable while appending a cursor page', async () => {
    const { result, rerender } = renderHook((props: {
      loadedItems: FeedItem[];
      reviewableIds: number[];
    }) => useReviewSession({
      ...props,
      visibleItemIds: new Set(props.reviewableIds),
      username: 'reader',
      isSyncComplete: false,
      orderKey: 'newest',
    }), {
      initialProps: { loadedItems: loadedPage, reviewableIds: [10, 9] },
    });
    await waitFor(() => expect(result.current.activeReviewIds).toEqual([10, 9]));

    rerender({ loadedItems: [], reviewableIds: [12, 11, 10, 9] });

    await waitFor(() => {
      expect(result.current.activeReviewIds).toEqual([10, 9, 12, 11]);
    });
  });

  it('extends a restored partial queue and reconciles it after full sync', async () => {
    window.localStorage.setItem(getReviewStateStorageKey('reader'), JSON.stringify({
      version: 1,
      pendingIds: [98, 96],
      revisitIds: [],
      keptItemIds: [],
    }));
    const { result, rerender } = renderHook((props: {
      loadedItems: FeedItem[];
      reviewableIds: number[];
      isSyncComplete: boolean;
    }) => useReviewSession({
      ...props,
      visibleItemIds: new Set([...props.reviewableIds, 98, 96]),
      username: 'reader',
      orderKey: 'newest',
    }), {
      initialProps: {
        loadedItems: loadedPage,
        reviewableIds: [110, 109],
        isSyncComplete: false,
      },
    });
    await waitFor(() => {
      expect(result.current.activeReviewIds).toEqual([110, 109, 98, 96]);
    });

    rerender({ loadedItems: [], reviewableIds: [110, 109, 108], isSyncComplete: true });

    await waitFor(() => {
      expect(result.current.activeReviewIds).toEqual([110, 109, 108]);
    });
  });

  it('releases the pinned item when the order changes', async () => {
    const { result, rerender } = renderHook((props: {
      reviewableIds: number[];
      orderKey: string;
    }) => useReviewSession({
      ...props,
      loadedItems: loadedPage,
      visibleItemIds: new Set(props.reviewableIds),
      username: null,
      isSyncComplete: true,
    }), {
      initialProps: { reviewableIds: [3, 2, 1], orderKey: 'newest' },
    });
    await waitFor(() => expect(result.current.activeReviewIds).toEqual([3, 2, 1]));

    rerender({ reviewableIds: [1, 2, 3], orderKey: 'oldest' });

    await waitFor(() => expect(result.current.activeReviewIds).toEqual([1, 2, 3]));
  });

  it('exposes keep, remove, and reset as session events', async () => {
    const { result } = renderHook(() => useReviewSession({
      loadedItems: loadedPage,
      reviewableIds: [1, 2],
      visibleItemIds: new Set([1, 2]),
      username: null,
      isSyncComplete: true,
      orderKey: 'newest',
    }));
    await waitFor(() => expect(result.current.activeReviewIds).toEqual([1, 2]));

    act(() => result.current.keep(1));
    expect(result.current.activeReviewIds).toEqual([2]);
    act(() => result.current.remove(2));
    expect(result.current.activeReviewIds).toEqual([1]);
    act(() => result.current.reset());
    expect(result.current.activeReviewIds).toEqual([1, 2]);
  });
});
