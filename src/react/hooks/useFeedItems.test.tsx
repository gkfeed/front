// @vitest-environment jsdom

import { act, cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  deleteFeedItemsCache,
  readFeedItemsCache,
  writeFeedItemsCache,
} from '../services/feedItemsCache';
import { getFeedItems } from '../services/feeds';
import type { FeedItem } from '../types';
import { useFeedItems } from './useFeedItems';

vi.mock('../services/feedItemsCache');
vi.mock('../services/feeds');

const CREDENTIALS = { username: 'reader', password: 'secret' };
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
  vi.resetAllMocks();
});

describe('useFeedItems', () => {
  it('uses a fresh cache as an initial snapshot and revalidates in background', async () => {
    vi.mocked(readFeedItemsCache).mockResolvedValue([DELETED_ITEM, CURRENT_ITEM]);
    let finishRevalidation!: (items: FeedItem[]) => void;
    vi.mocked(getFeedItems).mockImplementation(() => new Promise<FeedItem[]>((resolve) => {
      finishRevalidation = resolve;
    }));

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));

    await waitFor(() => expect(result.current.loadedItems).toEqual([DELETED_ITEM, CURRENT_ITEM]));
    expect(readFeedItemsCache).toHaveBeenCalledWith('reader', 15_000);
    expect(result.current.isSyncComplete).toBe(false);
    expect(getFeedItems).toHaveBeenCalledOnce();
    await act(async () => finishRevalidation([CURRENT_ITEM]));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    expect(result.current.loadedItems).toEqual([CURRENT_ITEM]);
    expect(writeFeedItemsCache).toHaveBeenCalledWith('reader', [CURRENT_ITEM]);
  });

  it('does not revalidate or change the snapshot when the window regains focus', async () => {
    vi.mocked(readFeedItemsCache).mockResolvedValue(undefined);
    vi.mocked(getFeedItems).mockResolvedValue([CURRENT_ITEM]);

    const { result } = renderHook(() => useFeedItems(CREDENTIALS));
    await waitFor(() => expect(result.current.isSyncComplete).toBe(true));
    const initialItems = result.current.loadedItems;

    await act(async () => fireEvent.focus(window));
    expect(getFeedItems).toHaveBeenCalledOnce();
    expect(result.current.loadedItems).toBe(initialItems);
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
    vi.mocked(readFeedItemsCache).mockResolvedValue([DELETED_ITEM]);
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
    expect(readFeedItemsCache).toHaveBeenCalledOnce();
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
