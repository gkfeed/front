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
});
