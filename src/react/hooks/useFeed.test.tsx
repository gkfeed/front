// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { AuthProvider } from '../state/AuthProvider';
import { useFeedPageModel as useFeed } from '../adapters/feeds/useFeedPageModel';

vi.mock('../services/feeds');

const feed = { id: 1, title: 'News', type: 'rss', url: 'https://example.com/feed.xml' };
const getFeed = vi.mocked(getFeedById);
const deleteFeed = vi.mocked(deleteFeedById);
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

afterEach(() => vi.resetAllMocks());

describe('useFeed', () => {
  it('rejects invalid route ids without requesting data', async () => {
    const { result } = renderHook(() => useFeed('0', vi.fn()), { wrapper });

    await waitFor(() => expect(result.current.loadStatus).toBe('not-found'));
    expect(getFeed).not.toHaveBeenCalled();
  });

  it('loads, confirms, and deletes a feed', async () => {
    const onDeleted = vi.fn();
    getFeed.mockResolvedValue(feed);
    deleteFeed.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFeed('1', onDeleted), { wrapper });

    await waitFor(() => expect(result.current.feed).toEqual(feed));
    act(result.current.requestDelete);
    expect(result.current.deleteStatus).toBe('confirming');
    await act(result.current.deleteFeed);
    expect(deleteFeed).toHaveBeenCalledWith(1, null);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('retries load failures', async () => {
    getFeed.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(feed);
    const { result } = renderHook(() => useFeed('1', vi.fn()), { wrapper });

    await waitFor(() => expect(result.current.loadStatus).toBe('error'));
    act(result.current.retryLoad);
    await waitFor(() => expect(result.current.feed).toEqual(feed));
    expect(getFeed).toHaveBeenCalledTimes(2);
  });

  it('exposes delete failures without closing confirmation', async () => {
    getFeed.mockResolvedValue(feed);
    deleteFeed.mockRejectedValue(new Error('failed'));
    const { result } = renderHook(() => useFeed('1', vi.fn()), { wrapper });

    await waitFor(() => expect(result.current.feed).toEqual(feed));
    act(result.current.requestDelete);
    await act(result.current.deleteFeed);
    expect(result.current.deleteStatus).toBe('error');
  });
});
