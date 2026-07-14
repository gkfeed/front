import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { createFeed, createFeedFromUrl, deleteFeedById, getAllFeeds, getFeedById, validateCredentials } from './feeds';
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

afterEach(() => vi.unstubAllGlobals());
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


  it('exposes the status of failed requests', async () => {
    respondWith(null, 401);

    await expect(deleteFeedById(7, CREDENTIALS)).rejects.toMatchObject({
      message: 'Request failed with 401',
      status: 401,
    });
    expect(fetch).toHaveBeenCalledWith('https://feed.gws.freemyip.com/api/v1/feeds/7', {
      method: 'DELETE',
      headers: { Authorization: 'Basic w7xzZXI6cMOkc3M=' },
      signal: expect.any(AbortSignal),
    });
  });
});
