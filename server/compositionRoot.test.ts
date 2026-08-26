import { describe, expect, it, vi } from 'vitest';

import { createPreviewComposition } from './compositionRoot.js';
import type { PreviewPorts } from './application/previewPorts.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';

const context = {} as RequestExecutionContext;

describe('server composition root', () => {
  it('wires provider ports and the concurrency policy into application use cases', async () => {
    const ports: PreviewPorts = {
      fetchOpenGraph: vi.fn().mockResolvedValue({ title: 'Story' }),
      fetchLiquipediaMatch: vi.fn().mockResolvedValue({ status: 'scheduled' }),
      fetchTikTokComments: vi.fn().mockResolvedValue({ comments: [] }),
      fetchTikTokVideo: vi.fn().mockResolvedValue({ url: 'https://video.example.com/tiktok.mp4' }),
      fetchRedditPreviewImage: vi.fn().mockResolvedValue({
        body: new Uint8Array([1]),
        contentType: 'image/png',
      }),
    };
    const limit = vi.fn(<T>(load: () => Promise<T>) => load());
    const useCases = createPreviewComposition({ ports, limit });

    await expect(useCases.openGraph('https://example.com', context))
      .resolves.toEqual({ title: 'Story' });
    await expect(useCases.redditPreviewImage('https://example.com/image', context))
      .resolves.toEqual({ body: new Uint8Array([1]), contentType: 'image/png' });

    expect(ports.fetchOpenGraph).toHaveBeenCalledWith('https://example.com', context);
    expect(ports.fetchRedditPreviewImage).toHaveBeenCalledWith('https://example.com/image', context);
    expect(limit).toHaveBeenCalledTimes(2);
  });
});
