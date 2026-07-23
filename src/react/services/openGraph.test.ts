import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOpenGraphPreview } from './openGraph';

afterEach(() => vi.unstubAllGlobals());

describe('getOpenGraphPreview', () => {
  it('requests the BFF endpoint with an encoded URL', async () => {
    const preview = {
      url: 'https://example.com/story?a=1&b=2',
      title: 'Story',
      description: null,
      image: 'https://example.com/cover.jpg',
      video: null,
      siteName: 'Example',
      type: 'article',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(preview)));

    await expect(getOpenGraphPreview(preview.url)).resolves.toEqual(preview);
    expect(fetch).toHaveBeenCalledWith(
      '/api/bff/open-graph?url=https%3A%2F%2Fexample.com%2Fstory%3Fa%3D1%26b%3D2',
      { signal: undefined },
    );
  });

  it('rejects malformed BFF responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ image: 42 })));
    await expect(getOpenGraphPreview('https://example.com')).rejects.toThrow('Invalid preview response');
  });

  it('loads generated Reddit cards through the crawler-aware image proxy', async () => {
    const preview = {
      url: 'https://www.reddit.com/r/example/comments/abc123/post/',
      title: 'Reddit post',
      description: null,
      image: 'https://share.redd.it/preview/post/abc123',
      video: null,
      siteName: 'Reddit',
      type: 'article',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(preview)));

    await expect(getOpenGraphPreview(preview.url)).resolves.toMatchObject({
      image: '/api/bff/reddit-preview-image?url=https%3A%2F%2Fshare.redd.it%2Fpreview%2Fpost%2Fabc123',
    });
  });

  it('upgrades HLTV URL2PNG images to HTTPS', async () => {
    const preview = {
      url: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
      title: 'OG vs Spirit',
      description: null,
      image: 'http://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(preview)));

    await expect(getOpenGraphPreview(preview.url)).resolves.toMatchObject({
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
    });
  });
});
