import { afterEach, describe, expect, it, vi } from 'vitest';

const CREDENTIALS = { username: 'user', password: 'pass' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('development API root', () => {
  it('uses the same-origin path handled by the Vite proxy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])));
    const { getAllFeeds } = await import('./feeds');

    await getAllFeeds(CREDENTIALS);

    expect(fetch).toHaveBeenCalledWith('/api/v1/list', expect.objectContaining({
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    }));
  });

  it('deletes feeds through the same-origin API root', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      id: 7,
      title: 'News',
      type: 'rss',
      url: 'https://example.com/feed.xml',
    })));
    const { deleteFeedById } = await import('./feeds');

    await deleteFeedById(7, CREDENTIALS);

    expect(fetch).toHaveBeenCalledWith('/api/v1/feeds/7', expect.objectContaining({
      method: 'DELETE',
    }));
  });
});
