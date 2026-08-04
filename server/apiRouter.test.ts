import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { handleBffRequest } from './apiRouter.js';
import { PreviewError } from './preview/errors.js';
import type { PreviewUseCases } from './application/previewUseCases.js';

function createResponse() {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function createUseCases(): PreviewUseCases {
  return {
    openGraph: vi.fn().mockResolvedValue({ title: 'Story' }),
    liquipediaMatch: vi.fn().mockResolvedValue({ status: 'scheduled' }),
    tiktokComments: vi.fn().mockResolvedValue({ comments: [] }),
    redditPreviewImage: vi.fn().mockResolvedValue({
      body: new Uint8Array([1, 2]),
      contentType: 'image/jpeg',
    }),
  };
}

describe('BFF HTTP router', () => {
  it('dispatches JSON routes through application use cases', async () => {
    const response = createResponse();
    const useCases = createUseCases();

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/open-graph?url=https%3A%2F%2Fexample.com'),
      response,
      undefined,
      useCases,
    )).resolves.toBe(true);

    expect(useCases.openGraph).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ title: 'Story' }));
  });

  it('keeps missing query validation at the HTTP boundary', async () => {
    const response = createResponse();

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/open-graph'),
      response,
    )).rejects.toMatchObject<PreviewError>({
      status: 400,
      code: 'missing_url',
    });
  });
});
