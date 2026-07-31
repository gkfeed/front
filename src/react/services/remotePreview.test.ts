import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BffHttpError,
  BffResponseError,
  BffTimeoutError,
} from './bffClient';
import { getLiquipediaMatchPreview } from './liquipedia';
import { getOpenGraphPreview } from './openGraph';
import { clearPreviewCache } from './previewQueue';
import { loadRemotePreview } from './remotePreview';

vi.mock('./liquipedia');
vi.mock('./openGraph');

const LIQUIPEDIA_URL = 'https://liquipedia.net/dota2/Match:Example';
const OPEN_GRAPH_PREVIEW = {
  url: LIQUIPEDIA_URL,
  title: 'Team Spirit vs VP.P',
  description: null,
  image: null,
  video: null,
  siteName: 'Liquipedia',
  type: 'website',
  providerData: null,
};

afterEach(() => {
  clearPreviewCache();
  vi.resetAllMocks();
});

describe('loadRemotePreview', () => {
  it.each([
    ['invalid response', new BffResponseError('Invalid Liquipedia preview response', '/api/bff/liquipedia-match', 200)],
    ['unsupported markup', new BffHttpError('Liquipedia preview request failed with 422', 422, '/api/bff/liquipedia-match')],
  ])('falls back to Open Graph for %s', async (_label, error) => {
    vi.mocked(getLiquipediaMatchPreview).mockRejectedValue(error);
    vi.mocked(getOpenGraphPreview).mockResolvedValue(OPEN_GRAPH_PREVIEW);

    await expect(loadRemotePreview(LIQUIPEDIA_URL, true, new AbortController().signal))
      .resolves.toEqual({ liquipediaMatch: null, openGraphPreview: OPEN_GRAPH_PREVIEW });
    expect(getOpenGraphPreview).toHaveBeenCalledWith(LIQUIPEDIA_URL, expect.any(AbortSignal));
  });

  it.each([
    ['abort', new DOMException('The operation was aborted', 'AbortError')],
    ['invalid JSON', new BffResponseError('Invalid Liquipedia preview response', '/api/bff/liquipedia-match', 200, 'invalid-json')],
    ['timeout', new BffTimeoutError('/api/bff/liquipedia-match', 10_000)],
    ['rate limit', new BffHttpError('Liquipedia preview request failed with 429', 429, '/api/bff/liquipedia-match')],
    ['upstream failure', new BffHttpError('Liquipedia preview request failed with 502', 502, '/api/bff/liquipedia-match')],
    ['auth failure', new BffHttpError('Liquipedia preview request failed with 401', 401, '/api/bff/liquipedia-match')],
    ['forbidden', new BffHttpError('Liquipedia preview request failed with 403', 403, '/api/bff/liquipedia-match')],
    ['transport failure', new TypeError('Failed to fetch')],
  ])('propagates %s instead of falling back', async (_label, error) => {
    vi.mocked(getLiquipediaMatchPreview).mockRejectedValue(error);

    await expect(loadRemotePreview(LIQUIPEDIA_URL, true, new AbortController().signal))
      .rejects.toBe(error);
    expect(getOpenGraphPreview).not.toHaveBeenCalled();
  });
});
