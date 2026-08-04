import { describe, expect, it, vi } from 'vitest';

import {
  createPreviewUseCases,
  type PreviewPorts,
} from './previewUseCases.js';
import type { RequestContext } from '../requestContext.js';

const context = {} as RequestContext;

describe('preview use cases', () => {
  it('composes provider ports behind the application boundary', async () => {
    const ports: PreviewPorts = {
      fetchOpenGraph: vi.fn().mockResolvedValue({ type: 'open-graph' }),
      fetchLiquipediaMatch: vi.fn().mockResolvedValue({ type: 'liquipedia' }),
      fetchTikTokComments: vi.fn().mockResolvedValue({ type: 'tiktok' }),
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
});
