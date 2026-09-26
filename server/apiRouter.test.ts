import type { ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { handleBffRequest } from './http/apiRouter.js';
import type { PreviewUseCases } from './application/previewUseCases.js';
import { createBffResultCache, type BffResultCache } from './http/bffResultCache.js';
import type { BffRequestGate } from './http/bffRequestGate.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';

function context(controller: AbortController): RequestExecutionContext {
  return {
    signal: controller.signal,
    deadline: Number.POSITIVE_INFINITY,
    remainingMs: (maximum = Number.POSITIVE_INFINITY) => maximum,
  };
}

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
    article: vi.fn().mockResolvedValue({
      url: 'https://example.com/article',
      title: 'Article',
      byline: null,
      excerpt: null,
      blocks: [{ type: 'paragraph', text: 'Body' }],
    }),
    openGraph: vi.fn().mockResolvedValue({ title: 'Story' }),
    liquipediaMatch: vi.fn().mockResolvedValue({ status: 'scheduled' }),
    tiktokPlayback: vi.fn().mockResolvedValue({ videoUrl: 'https://v.tiktokcdn.com/video.mp4' }),
    tiktokComments: vi.fn().mockResolvedValue({
      comments: [],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    }),
    youtubeComments: vi.fn().mockResolvedValue({ comments: [] }),
    youtubeTimecodes: vi.fn().mockResolvedValue({ timecodes: [] }),
    redditPreviewImage: vi.fn().mockResolvedValue({
      body: new Uint8Array([1, 2]),
      contentType: 'image/jpeg',
    }),
    sasflixMedia: vi.fn(),
    vkVideoSource: vi.fn().mockResolvedValue({
      url: 'https://cdn.example.com/video.mp4',
      referer: 'https://vk.ru/',
    }),
    vkVideoStream: vi.fn(),
    hltvLiveIndex: vi.fn().mockResolvedValue({ eventIds: ['2396948'] }),
  };
}

describe('BFF HTTP router', () => {
  it('dispatches JSON routes through application use cases', async () => {
    const response = createResponse();
    const useCases = createUseCases();

    await expect(handleBffRequest(
      new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Fexample.com'),
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
    ['/bff/liquipedia-match', 'liquipediaMatch', { status: 'scheduled' }],
    ['/bff/tiktok-comments', 'tiktokComments', {
      comments: [],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    }],
    ['/bff/youtube-comments', 'youtubeComments', { comments: [] }],
    ['/bff/youtube-timecodes', 'youtubeTimecodes', { timecodes: [] }],
  ] as const)('dispatches %s through its application use case', async (pathname, useCaseName, result) => {
    const response = createResponse();
    const useCases = createUseCases();

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
      new URL('http://localhost/bff/open-graph'),
      response,
    )    ).rejects.toMatchObject({
      code: 'missing_url',
      kind: 'missing_url',
      status: 400,
    });
  });

  it('serves the shared HLTV live index without a URL query', async () => {
    const response = createResponse();
    const useCases = createUseCases();

    await expect(handleBffRequest(
      new URL('http://localhost/bff/hltv-live'),
      response,
      undefined,
      useCases,
    )).resolves.toBe(true);

    expect(useCases.hltvLiveIndex).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ eventIds: ['2396948'] }));
  });

  it('uses distinct feed-type cache keys when URLs and titles contain colons', async () => {
    const keys: string[] = [];
    const cache = {
      load: async (key: string) => {
        keys.push(key);
        return { type: 'web', confidence: 1 };
      },
    } as BffResultCache;
    const first = new URL('http://localhost/bff/feed-type');
    first.searchParams.set('url', 'https://example.com/p:a');
    first.searchParams.set('title', 'b');
    const second = new URL('http://localhost/bff/feed-type');
    second.searchParams.set('url', 'https://example.com/p');
    second.searchParams.set('title', 'a:b');

    await handleBffRequest(first, createResponse(), undefined, createUseCases(), 'feed-type-test', undefined, cache);
    await handleBffRequest(second, createResponse(), undefined, createUseCases(), 'feed-type-test', undefined, cache);

    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it.each([
    '/bff/hltv-live',
    '/bff/open-graph?url=https%3A%2F%2Fwww.hltv.org%2Fmatches%2F123%2Ftest',
    '/bff/open-graph?url=https%3A%2F%2Fonefootball.com%2Fen%2Fmatch%2F123',
  ])('fetches fresh live data on repeated %s requests', async (path) => {
    const useCases = createUseCases();
    const cache = createBffResultCache();
    const url = new URL(`http://localhost${path}`);

    await handleBffRequest(url, createResponse(), undefined, useCases, 'live-test', undefined, cache);
    await handleBffRequest(url, createResponse(), undefined, useCases, 'live-test', undefined, cache);

    const load = path === '/bff/hltv-live' ? useCases.hltvLiveIndex : useCases.openGraph;
    expect(load).toHaveBeenCalledTimes(2);
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
      new URL('http://localhost/bff/reddit-preview-image?url=https%3A%2F%2Fshare.redd.it%2Fpreview%2Fpost%2Fabc'),
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

  it('does not claim the old API-prefixed BFF routes', async () => {
    const response = createResponse();

    await expect(handleBffRequest(
      new URL('http://localhost/api/bff/open-graph?url=https%3A%2F%2Fexample.com'),
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
      new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Ffailing.example'),
      response,
      undefined,
      useCases,
    )).rejects.toBe(failure);

    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });

  it('applies client admission even when the preview result is cached', async () => {
    const useCases = createUseCases();
    const cache = createBffResultCache();
    const run = vi.fn(<T>(_clientId: string, _context: unknown, load: () => Promise<T>) => load());
    const gate: BffRequestGate = { run } as BffRequestGate;
    const url = new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Fcached.example');

    await handleBffRequest(url, createResponse(), undefined, useCases, '203.0.113.1', gate, cache);
    await handleBffRequest(url, createResponse(), undefined, useCases, '203.0.113.1', gate, cache);

    expect(run).toHaveBeenCalledTimes(2);
    expect(useCases.openGraph).toHaveBeenCalledOnce();
  });

  it('returns a shared preview to the remaining client after the first disconnects', async () => {
    const useCases = createUseCases();
    const cache = createBffResultCache();
    const gate: BffRequestGate = { run: (_clientId, _context, load) => load() };
    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstResponse = createResponse();
    const secondResponse = createResponse();
    const url = new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Fexample.com');
    let release!: (value: Awaited<ReturnType<PreviewUseCases['openGraph']>>) => void;
    const preview = {
      url: 'https://example.com',
      title: 'Story',
      description: null,
      image: null,
      video: null,
      siteName: null,
      type: null,
      providerData: null,
    };
    vi.mocked(useCases.openGraph).mockImplementation(() => new Promise((resolve) => {
      release = resolve;
    }));

    const first = handleBffRequest(url, firstResponse, context(firstController), useCases, 'first', gate, cache);
    const second = handleBffRequest(url, secondResponse, context(secondController), useCases, 'second', gate, cache);
    await vi.waitFor(() => expect(useCases.openGraph).toHaveBeenCalledOnce());
    firstController.abort();

    await expect(first).rejects.toThrow('Request aborted');
    release(preview);
    await expect(second).resolves.toBe(true);
    expect(firstResponse.end).not.toHaveBeenCalled();
    expect(secondResponse.end).toHaveBeenCalledWith(JSON.stringify(preview));
  });

  it('refreshes HLTV match previews before the next 30-second poll', async () => {
    let timestamp = 1_000;
    const cache = createBffResultCache({ now: () => timestamp });
    const useCases = createUseCases();
    const url = new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Fwww.hltv.org%2Fmatches%2F1234567%2Fmatch');

    await handleBffRequest(url, createResponse(), undefined, useCases, 'client', undefined, cache);
    timestamp += 30_000;
    await handleBffRequest(url, createResponse(), undefined, useCases, 'client', undefined, cache);

    expect(useCases.openGraph).toHaveBeenCalledTimes(2);
  });

  it('expires ordinary previews after one minute and articles after five minutes', async () => {
    let timestamp = 1_000;
    const cache = createBffResultCache({ now: () => timestamp });
    const useCases = createUseCases();
    const previewUrl = new URL('http://localhost/bff/open-graph?url=https%3A%2F%2Fexample.com');
    const articleUrl = new URL('http://localhost/bff/article?url=https%3A%2F%2Fexample.com%2Farticle');
    const fetchBoth = async () => {
      await handleBffRequest(previewUrl, createResponse(), undefined, useCases, 'client', undefined, cache);
      await handleBffRequest(articleUrl, createResponse(), undefined, useCases, 'client', undefined, cache);
    };

    await fetchBoth();
    timestamp += 60_000;
    await fetchBoth();
    expect(useCases.openGraph).toHaveBeenCalledTimes(2);
    expect(useCases.article).toHaveBeenCalledOnce();

    timestamp += 4 * 60_000;
    await fetchBoth();
    expect(useCases.article).toHaveBeenCalledTimes(2);
  });

  it('shares concurrent TikTok playback lookups without retaining signed URLs', async () => {
    const cache = createBffResultCache();
    const useCases = createUseCases();
    const gate: BffRequestGate = { run: (_clientId, _context, load) => load() };
    const url = new URL('http://localhost/bff/tiktok-playback?url=https%3A%2F%2Fwww.tiktok.com%2F%40user%2Fvideo%2F123');
    let release!: (value: Awaited<ReturnType<PreviewUseCases['tiktokPlayback']>>) => void;
    vi.mocked(useCases.tiktokPlayback).mockImplementationOnce(() => new Promise((resolve) => {
      release = resolve;
    }));

    const first = handleBffRequest(url, createResponse(), undefined, useCases, 'first', gate, cache);
    const second = handleBffRequest(url, createResponse(), undefined, useCases, 'second', gate, cache);
    await vi.waitFor(() => expect(useCases.tiktokPlayback).toHaveBeenCalledOnce());
    release({ videoUrl: 'https://v.tiktokcdn.com/video.mp4' });
    await Promise.all([first, second]);
    await handleBffRequest(url, createResponse(), undefined, useCases, 'third', gate, cache);

    expect(useCases.tiktokPlayback).toHaveBeenCalledTimes(2);
  });
});
