import { describe, expect, it, vi } from 'vitest';

import {
  createPreviewUseCases,
  type PreviewPorts,
} from './previewUseCases.js';
import type { RequestExecutionContext } from './requestExecutionContext.js';

const context = {} as RequestExecutionContext;

describe('preview use cases', () => {
  it('composes provider ports behind the application boundary', async () => {
    const ports: PreviewPorts = {
      fetchOpenGraph: vi.fn().mockResolvedValue({ type: 'open-graph' }),
      fetchLiquipediaMatch: vi.fn().mockResolvedValue({ type: 'liquipedia' }),
      fetchTikTokComments: vi.fn().mockResolvedValue({ type: 'tiktok' }),
      fetchTikTokVideo: vi.fn().mockResolvedValue({ url: 'https://video.example.com/tiktok.mp4' }),
      fetchRedditPreviewImage: vi.fn().mockResolvedValue({
        body: new Uint8Array([1, 2, 3]),
        contentType: 'image/jpeg',
      }),
    };
    const useCases = createPreviewUseCases(ports);

    await expect(useCases.openGraph('https://example.com', context))
      .resolves.toEqual({ type: 'open-graph' });
    await expect(useCases.liquipediaMatch('https://liquipedia.net', context))
      .resolves.toEqual({ type: 'liquipedia' });
    await expect(useCases.tiktokComments('https://tiktok.com/video', context))
      .resolves.toEqual({ type: 'tiktok' });
    await expect(useCases.redditPreviewImage('https://reddit.com/image', context))
      .resolves.toEqual({ body: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' });

    expect(ports.fetchOpenGraph).toHaveBeenCalledWith('https://example.com', context);
    expect(ports.fetchLiquipediaMatch).toHaveBeenCalledWith('https://liquipedia.net', context);
    expect(ports.fetchTikTokComments).toHaveBeenCalledWith('https://tiktok.com/video', context);
    expect(ports.fetchRedditPreviewImage).toHaveBeenCalledWith('https://reddit.com/image', context);
  });

  it('applies the concurrency policy around every provider port', async () => {
    const ports: PreviewPorts = {
      fetchOpenGraph: vi.fn().mockResolvedValue({}),
      fetchLiquipediaMatch: vi.fn().mockResolvedValue({}),
      fetchTikTokComments: vi.fn().mockResolvedValue({}),
      fetchTikTokVideo: vi.fn().mockResolvedValue({ url: 'https://video.example.com/tiktok.mp4' }),
      fetchRedditPreviewImage: vi.fn().mockResolvedValue({ body: new Uint8Array(), contentType: 'image/png' }),
    };
    const limit = vi.fn(<T>(load: () => Promise<T>) => load());
    const useCases = createPreviewUseCases(ports, limit);

    await useCases.openGraph('https://example.com', context);
    await useCases.liquipediaMatch('https://liquipedia.net', context);
    await useCases.tiktokComments('https://tiktok.com/video', context);
    await useCases.redditPreviewImage('https://reddit.com/image', context);

    expect(limit).toHaveBeenCalledTimes(4);
  });
});
