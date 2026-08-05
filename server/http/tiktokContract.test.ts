import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { isTikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import { routeBffRequest } from './bffRouter.js';

describe('TikTok HTTP contract', () => {
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
