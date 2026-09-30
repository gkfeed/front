import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFeed,
  createFeedFromUrl,
  deleteFeedById,
  deleteFeedItemById,
  getAllFeeds,
  getFeedById,
  getFeedItems,
} from './feeds';
import { validateCredentials } from './auth';
import { getFeedItemChanges, syncFeedItems } from './feedItems';
import type { Feed } from '../types';

vi.hoisted(() => {
  vi.stubEnv('VITE_API_ROOT', 'https://feed.gws.freemyip.com/api/v1');
});

const CREDENTIALS = { username: 'üser', password: 'päss' };
const FEEDS: Feed[] = [
  { id: 1, title: 'News', type: 'rss', url: 'https://example.com/feed.xml' },
  { id: 2, title: 'Videos', type: 'youtube', url: 'https://youtube.com/example' },
];

function respondWith(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
}

function respondWithoutBody(status = 201) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
afterAll(() => vi.unstubAllEnvs());

describe('feed service', () => {
  it('lists feeds with basic authentication', async () => {
    respondWith(FEEDS);

    await expect(getAllFeeds(CREDENTIALS)).resolves.toEqual(FEEDS);
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/list', {
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });

  it('validates credentials against a protected endpoint', async () => {
    respondWith(FEEDS);

    await expect(validateCredentials(CREDENTIALS)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/list', expect.objectContaining({
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
    }));
  });

  it('rejects missing credentials before requesting protected endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAllFeeds(null)).rejects.toMatchObject({
      message: 'Login required',
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('finds a feed by id from the current list', async () => {
    respondWith(FEEDS);

    await expect(getFeedById(2, CREDENTIALS)).resolves.toEqual(FEEDS[1]);
  });

  it('rejects malformed API data', async () => {
    respondWith([{ ...FEEDS[0], id: 0 }]);

    await expect(getAllFeeds(CREDENTIALS)).rejects.toThrow('Invalid API response');
  });

  it('creates a feed with JSON and basic authentication', async () => {
    const input = { title: 'News', type: 'rss', url: 'https://example.com/feed.xml' };
    respondWithoutBody();

    await expect(createFeed(input, CREDENTIALS)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      body: JSON.stringify(input),
      signal: expect.any(AbortSignal),
    });
  });

  it('creates a feed lazily from URL only', async () => {
    const input = { url: 'https://www.youtube.com/@gkfeed' };
    respondWithoutBody();

    await expect(createFeedFromUrl(input, CREDENTIALS)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/add_lazy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      body: JSON.stringify(input),
      signal: expect.any(AbortSignal),
    });
  });

  it('loads and normalizes items from the v2 sync endpoint', async () => {
    respondWith({
      items: [
        { id: 10, feed_id: 2, link: 'https://vk.ru/wall-1_2', title: '\uFFFD', text: 'Text 🎉' },
        { id: 11, feed_id: 2, link: '', title: 'Missing link', text: '' },
      ],
      next_cursor: '',
      has_more: false,
      sync_cursor: 'sync-1',
    });

    await expect(getFeedItems(CREDENTIALS)).resolves.toEqual([
      { id: 10, feedId: 2, link: 'https://vk.com/wall-1_2', title: '', text: 'Text 🎉' },
    ]);
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v2/items/sync?limit=100', {
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });

  it('follows opaque page cursors and preserves the first sync cursor', async () => {
    const onProgress = vi.fn();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({
        items: [{ id: 10, feed_id: 2, link: 'https://example.com/10', title: 'Ten', text: '' }],
        next_cursor: 'page+1', has_more: true, sync_cursor: 'sync-1',
      }))
      .mockResolvedValueOnce(Response.json({
        items: [{ id: 9, feed_id: 2, link: 'https://example.com/9', title: 'Nine', text: '' }],
        next_cursor: '', has_more: false, sync_cursor: 'sync-2',
      })));

    await expect(syncFeedItems(CREDENTIALS, undefined, onProgress, 10)).resolves.toEqual({
      items: [
        { id: 10, feedId: 2, link: 'https://example.com/10', title: 'Ten', text: '' },
        { id: 9, feedId: 2, link: 'https://example.com/9', title: 'Nine', text: '' },
      ],
      cursor: 'sync-1',
    });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(2,
      'https://feed.gws.freemyip.com/api/v2/items/sync?limit=100&cursor=page%2B1',
      expect.any(Object));
  });

  it('loads beyond 1000 items without an implicit cap', async () => {
    let pageIndex = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const index = pageIndex++;
      return Promise.resolve(Response.json({
        items: Array.from({ length: 100 }, (_, offset) => {
          const id = 2_000 - index * 100 - offset;
          return { id, feed_id: 2, link: `https://example.com/${id}`, title: `${id}`, text: '' };
        }),
        next_cursor: index < 10 ? `page-${index + 1}` : '',
        has_more: index < 10,
        sync_cursor: 'first',
      }));
    }));

    await expect(getFeedItems(CREDENTIALS)).resolves.toHaveLength(1_100);
    expect(fetch).toHaveBeenCalledTimes(11);
  });

  it.each(['response', 'progress'] as const)('rejects cancellation during %s instead of returning a partial snapshot', async (stage) => {
    const controller = new AbortController();
    const page = {
      items: [{ id: 10, feed_id: 2, link: 'https://example.com/10', title: 'Ten', text: '' }],
      next_cursor: 'page-2', has_more: true, sync_cursor: 'baseline',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        if (stage === 'response') controller.abort();
        return page;
      },
    }));
    const onProgress = vi.fn(() => {
      if (stage === 'progress') controller.abort();
      return false;
    });

    await expect(syncFeedItems(CREDENTIALS, controller.signal, onProgress))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledTimes(stage === 'response' ? 0 : 1);
  });

  it('allows Live discovery to stop pagination without cancelling the request', async () => {
    respondWith({
      items: [{ id: 10, feed_id: 2, link: 'https://example.com/10', title: 'Ten', text: '' }],
      next_cursor: 'page-2', has_more: true, sync_cursor: 'baseline',
    });

    await expect(getFeedItems(CREDENTIALS, undefined, undefined, () => false))
      .resolves.toEqual([{ id: 10, feedId: 2, link: 'https://example.com/10', title: 'Ten', text: '' }]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('parses upserts and tombstones from changes', async () => {
    respondWith({
      upserted: [{ id: 12, feed_id: 2, link: 'https://example.com/12', title: 'New', text: '' }],
      deleted_ids: [10], next_cursor: 'next', has_more: false,
    });

    await expect(getFeedItemChanges(CREDENTIALS, 'sync+1')).resolves.toEqual({
      upserted: [{ id: 12, feedId: 2, link: 'https://example.com/12', title: 'New', text: '' }],
      deletedIds: [10], nextCursor: 'next', hasMore: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://feed.gws.freemyip.com/api/v2/items/changes?cursor=sync%2B1&limit=100',
      expect.any(Object),
    );
  });

  it('removes an existing item if an update no longer has a usable link', async () => {
    respondWith({
      upserted: [{ id: 10, feed_id: 2, link: '', title: 'Unavailable', text: '' }],
      deleted_ids: [], next_cursor: 'next', has_more: false,
    });

    await expect(getFeedItemChanges(CREDENTIALS, 'saved')).resolves.toEqual({
      upserted: [], deletedIds: [10], nextCursor: 'next', hasMore: false,
    });
  });

  it('applies a timeout to item requests', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    )));

    const rejection = expect(getFeedItems(CREDENTIALS)).rejects.toMatchObject({
      name: 'ApiTimeoutError', timeoutMs: 100_000,
    });
    await vi.advanceTimersByTimeAsync(100_000);
    await rejection;
  });

  it('rejects malformed sync cursors', async () => {
    respondWith({ items: [], next_cursor: '', has_more: false, sync_cursor: null });
    await expect(getFeedItems(CREDENTIALS)).rejects.toThrow('Invalid API response');
  });

  it('deletes a feed reader item using the API item route', async () => {
    respondWithoutBody(204);

    await expect(deleteFeedItemById(10, CREDENTIALS)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/items/10', {
      method: 'DELETE',
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });

  it('deletes a feed using the API delete route', async () => {
    respondWithoutBody(200);

    await expect(deleteFeedById(7, CREDENTIALS)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/delete?id=7', {
      method: 'DELETE',
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });

  it('exposes the status of failed requests', async () => {
    respondWith(null, 401);

    await expect(deleteFeedById(7, CREDENTIALS)).rejects.toMatchObject({
      message: 'Request failed with 401',
      status: 401,
    });
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/delete?id=7', {
      method: 'DELETE',
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });
});
