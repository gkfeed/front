import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { isTikTokPlaybackPreview, isTikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import { routeBffRequest } from './bffRouter.js';

describe('TikTok HTTP contract', () => {
  it('validates playback responses and resolves fresh URLs on repeated requests', async () => {
    const response = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
    const tiktokPlayback = vi.fn().mockResolvedValue({ videoUrl: 'https://v.tiktokcdn.com/video.mp4' });
    const useCases = { tiktokPlayback } as unknown as PreviewUseCases;
    const url = new URL('http://localhost/bff/tiktok-playback?url=https://www.tiktok.com/@creator/video/123');
    await routeBffRequest(url, response, undefined, useCases);
    await routeBffRequest(url, response, undefined, useCases);
    expect(tiktokPlayback).toHaveBeenCalledTimes(2);
    const body = vi.mocked(response.end).mock.calls[0][0] as string;
    expect(isTikTokPlaybackPreview(JSON.parse(body))).toBe(true);
    tiktokPlayback.mockResolvedValue({ videoUrl: 'https://localhost/video' });
    await expect(routeBffRequest(url, response, undefined, useCases)).rejects.toThrow('Invalid preview contract');
  });

  it('serializes the shared TikTok preview contract at the BFF boundary', async () => {
    let body = '';
    const response = {
      writeHead: vi.fn(),
      end: vi.fn((value?: string) => {
        body = value ?? '';
      }),
    } as unknown as ServerResponse;
    const useCases = {
      tiktokComments: vi.fn().mockResolvedValue({
        comments: [],
        description: 'Caption',
        creatorName: 'Creator',
        creatorAvatarUrl: null,
      }),
    } as unknown as PreviewUseCases;

    await routeBffRequest(
      new URL('http://localhost/bff/tiktok-comments?url=https%3A%2F%2Fwww.tiktok.com%2F%40creator%2Fvideo%2F123'),
      response,
      undefined,
      useCases,
    );

    expect(isTikTokCommentsPreview(JSON.parse(body))).toBe(true);
    expect(JSON.parse(body)).toMatchObject({ creatorName: 'Creator', creatorAvatarUrl: null });
  });
});
