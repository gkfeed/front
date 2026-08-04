import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { handleBffRequest } from './apiRouter.js';
import type { PreviewUseCases } from './application/previewUseCases.js';
import { HttpRequestError } from './http/httpErrors.js';

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

  it.each([
    ['/api/bff/liquipedia-match', 'liquipediaMatch', { status: 'live' }],
    ['/api/bff/tiktok-comments', 'tiktokComments', { comments: [] }],
  ] as const)('dispatches %s through its application use case', async (pathname, useCaseName, result) => {
    const response = createResponse();
    const useCases = createUseCases();
    vi.mocked(useCases[useCaseName]).mockResolvedValue(result);

    await expect(handleBffRequest(
      new URL(`http://localhost${pathname}?url=https%3A%2F%2Fexample.com`),
      response,
      undefined,
      useCases,
    )).resolves.toBe(true);

    expect(useCases[useCaseName]).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.end).toHaveBeenCalledWith(JSON.stringify(result));
  });

  it('keeps missing query validation at the HTTP boundary', async () => {
    const response = createResponse();

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/open-graph'),
      response,
    )).rejects.toMatchObject<HttpRequestError>({
      code: 'missing_url',
      kind: 'missing_url',
      status: 400,
    });
  });

  it('serves Reddit preview images through the HTTP adapter', async () => {
    const response = createResponse();
    const useCases = createUseCases();
    const body = new Uint8Array([1, 2]);

    vi.mocked(useCases.redditPreviewImage).mockResolvedValue({
      body,
      contentType: 'image/webp',
    });

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/reddit-preview-image?url=https%3A%2F%2Fshare.redd.it%2Fpreview%2Fpost%2Fabc'),
      response,
      undefined,
      useCases,
    )).resolves.toBe(true);

    expect(useCases.redditPreviewImage).toHaveBeenCalledWith(
      'https://share.redd.it/preview/post/abc',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'cache-control': 'public, max-age=3600',
      'content-length': 2,
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
    });
    expect(response.end).toHaveBeenCalledWith(body);
  });

  it('does not claim unrelated routes', async () => {
    const response = createResponse();

    await expect(handleBffRequest(
      new URL('http://localhost/api/other'),
      response,
    )).resolves.toBe(false);

    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });

  it('leaves application failures for the outer HTTP error mapper', async () => {
    const response = createResponse();
    const useCases = createUseCases();
    const failure = new Error('provider failure');
    vi.mocked(useCases.openGraph).mockRejectedValue(failure);

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/open-graph?url=https%3A%2F%2Fexample.com'),
      response,
      undefined,
      useCases,
    )).rejects.toBe(failure);

    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });
});
