// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteFeedItemsCache,
  readFeedItemsCache,
  writeFeedItemsCache,
} from '../services/feedItemsCache';
import { getFeedItems } from '../services/feeds';
import { getFeedItemChanges } from '../services/feedItems';
import type { FeedItem } from '../types';
import { useFeedItems } from './useFeedItems';
import { useReviewSession } from './useReviewSession';
import { getReviewStateStorageKey, readReviewState, writeReviewState } from './reviewStateStorage';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';

vi.mock('../services/feedItemsCache');
vi.mock('../services/feeds');
vi.mock('../services/feedItems');

const CREDENTIALS = { username: 'reader', password: 'secret' };
const REVIEW_PRESENTATION = {
  itemOrder: 'desc', nsfwMode: 'show', hideTikTokItems: false, feedPriorities: {},
} as const;
const DELETED_ITEM: FeedItem = {
  id: 10,
  feedId: 2,
  link: 'https://example.com/deleted',
  title: 'Deleted elsewhere',
  text: '',
};
const CURRENT_ITEM: FeedItem = {
  id: 9,
  feedId: 2,
  link: 'https://example.com/current',
  title: 'Current',
  text: '',
};

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('useFeedItems', () => {
  it('shows committed change pages and removes confirmed deletions when later changes fail', async () => {
    stubLocalStorage();
    vi.mocked(readFeedItemsCache).mockResolvedValue({ items: [DELETED_ITEM], cursor: 'saved' });
    let finishFirstPage!: (page: Awaited<ReturnType<typeof getFeedItemChanges>>) => void;
    vi.mocked(getFeedItemChanges)
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirstPage = resolve; }))
      .mockRejectedValueOnce(new Error('Later change page failed'));
    const { result } = renderHook(() => {
      const loaded = useFeedItems(CREDENTIALS);
      const session = useReviewSession({
        loadedItems: loaded.loadedItems,
        username: CREDENTIALS.username,
        isSyncComplete: loaded.isSyncComplete,
        isSnapshotComplete: loaded.isSnapshotComplete,
        isSyncFailed: loaded.status === 'error',
        ...REVIEW_PRESENTATION,
      });
      return { loaded, session };
    });
    await waitFor(() => expect(result.current.session.items).toEqual([DELETED_ITEM]));

    await act(async () => finishFirstPage({
      upserted: [CURRENT_ITEM], deletedIds: [DELETED_ITEM.id], nextCursor: 'page2', hasMore: true,
    }));

    await waitFor(() => expect(result.current.loaded.status).toBe('error'));
    expect(result.current.loaded.isSyncComplete).toBe(false);
    expect(result.current.loaded.loadedItems).toEqual([CURRENT_ITEM]);
    expect(result.current.session.items).toEqual([CURRENT_ITEM]);
    expect(result.current.session.activeReviewIds).toEqual([CURRENT_ITEM.id]);
    expect(writeFeedItemsCache).toHaveBeenCalledWith('reader', { items: [CURRENT_ITEM], cursor: 'page2' });
  });

  it('uses a fresh cache as an initial snapshot and revalidates in background', async () => {
    vi.mocked(readFeedItemsCache).mockResolvedValue({ items: [DELETED_ITEM, CURRENT_ITEM] });
    let finishRevalidation!: (items: FeedItem[]) => void;
    vi.mocked(getFeedItems).mockImplementation(() => new Promise<FeedItem[]>((resolve) => {
      finishRevalidation = resolve;
    }));

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));

    await waitFor(() => expect(result.current.loadedItems).toEqual([DELETED_ITEM, CURRENT_ITEM]));
    expect(readFeedItemsCache).toHaveBeenCalledWith('reader');
    expect(result.current.isSyncComplete).toBe(false);
    expect(getFeedItems).toHaveBeenCalledOnce();
    await act(async () => finishRevalidation([CURRENT_ITEM]));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM]);
    expect(writeFeedItemsCache).not.toHaveBeenCalled();
  });

  it('revalidates when the window regains focus', async () => {
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockResolvedValue([CURRENT_ITEM]);

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    const initialItems = result.current.loadedItems;

    await act(async () => fireEvent.focus(window));
    expect(getFeedItems).toHaveBeenCalledTimes(2);
    expect(result.current.loadedItems).toBe(initialItems);
  });

  it('preserves saved decisions missing from a stale cache until revalidation completes', async () => {
    stubLocalStorage();
    const key = getReviewStateStorageKey(CREDENTIALS.username);
    writeReviewState(key, {
      pendingIds: [CURRENT_ITEM.id], revisitIds: [], keptItemIds: new Set([DELETED_ITEM.id]),
    });
    vi.mocked(readFeedItemsCache).mockResolvedValue({ items: [CURRENT_ITEM] });
    let finishLoad!: (items: FeedItem[]) => void;
    vi.mocked(getFeedItems).mockImplementation(() => new Promise((resolve) => { finishLoad = resolve; }));
    const { result } = renderHook(() => {
      const loaded = useFeedItems(CREDENTIALS);
      return useReviewSession({
        loadedItems: loaded.loadedItems,
        username: CREDENTIALS.username,
        isSyncComplete: loaded.isSyncComplete,
        isSyncFailed: loaded.status === 'error',
        ...REVIEW_PRESENTATION,
      });
    });

    await waitFor(() => expect(result.current.items).toEqual([CURRENT_ITEM]));
    expect(readReviewState(key)?.keptItemIds.has(DELETED_ITEM.id)).toBe(true);
    await act(async () => finishLoad([DELETED_ITEM, CURRENT_ITEM]));
    expect(result.current.activeReviewIds).toEqual([CURRENT_ITEM.id]);
    expect(readReviewState(key)?.keptItemIds.has(DELETED_ITEM.id)).toBe(true);
  });

  it('checks for changes every minute while the tab is visible', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockResolvedValue([CURRENT_ITEM]);

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    expect(getFeedItems).toHaveBeenCalledOnce();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 60_000);
    const poll = interval.mock.calls.find(([, delay]) => delay === 60_000)?.[0];

    await act(async () => (poll as (() => void) | undefined)?.());
    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
  });

  it('starts with 10 items and publishes each accumulated cursor page', async () => {
    let publishProgress: ((items: FeedItem[]) => boolean | void) | undefined;
    let finishLoad: ((items: FeedItem[]) => void) | undefined;
    const secondPageItem = { ...DELETED_ITEM, id: 8, title: 'Older item' };
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => (
      new Promise((resolve) => {
        publishProgress = onProgress;
        finishLoad = resolve;
      })
    ));

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    expect(result.current.loadedItems).toBeUndefined();
    expect(result.current.isSyncComplete).toBe(false);
    expect(getFeedItems).toHaveBeenCalledWith(
      CREDENTIALS,
      undefined,
      expect.any(AbortSignal),
      expect.any(Function),
      10,
    );

    act(() => publishProgress?.([CURRENT_ITEM]));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM]);

    act(() => publishProgress?.([CURRENT_ITEM, secondPageItem]));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM, secondPageItem]);

    await act(async () => finishLoad?.([CURRENT_ITEM, secondPageItem]));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM, secondPageItem]);
    expect(result.current.isSyncComplete).toBe(true);
  });

  it('preserves published cursor pages when a later page fails', async () => {
    let publishProgress: ((items: FeedItem[]) => boolean | void) | undefined;
    let failLoad: ((error: Error) => void) | undefined;
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => (
      new Promise((_resolve, reject) => {
        publishProgress = onProgress;
        failLoad = reject;
      })
    ));

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());

    act(() => publishProgress?.([CURRENT_ITEM]));
    await act(async () => failLoad?.(new Error('Later page failed')));

    expect(result.current.loadedItems).toEqual([CURRENT_ITEM]);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toEqual(new Error('Later page failed'));
    expect(result.current.isSyncComplete).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('bypasses the cache only after an explicit retry', async () => {
    vi.mocked(readFeedItemsCache).mockResolvedValue({ items: [DELETED_ITEM] });
    let finishInitialLoad!: (items: FeedItem[]) => void;
    vi.mocked(getFeedItems).mockImplementation(() => new Promise<FeedItem[]>((resolve) => {
      finishInitialLoad = resolve;
    }));
    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(result.current.loadedItems).toEqual([DELETED_ITEM]));
    expect(result.current.isSyncComplete).toBe(false);
    await act(async () => finishInitialLoad([CURRENT_ITEM]));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM]);
    expect(readFeedItemsCache).toHaveBeenCalledOnce();
    expect(getFeedItems).toHaveBeenCalledOnce();

    vi.mocked(getFeedItems).mockResolvedValue([DELETED_ITEM]);
    act(result.current.retry);

    await waitFor(() => expect(result.current.loadedItems).toEqual([DELETED_ITEM]));
    expect(readFeedItemsCache).toHaveBeenCalledTimes(2);
    expect(getFeedItems).toHaveBeenCalledTimes(2);
  });

  it('invalidates the current user cache and prevents an in-flight stale write', async () => {
    let finishLoad: ((items: FeedItem[]) => void) | undefined;
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockImplementation(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());

    act(result.current.invalidateCache);
    await act(async () => finishLoad?.([CURRENT_ITEM]));

    expect(deleteFeedItemsCache).toHaveBeenCalledWith('reader');
    expect(writeFeedItemsCache).not.toHaveBeenCalled();
  });
});
