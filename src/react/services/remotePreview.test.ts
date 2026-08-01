import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BffHttpError,
  BffResponseError,
  BffTimeoutError,
} from './bffClient';
import { getLiquipediaMatchPreview } from './liquipedia';
import { getOpenGraphPreview, type OpenGraphPreview } from './openGraph';
import { clearPreviewCache } from './previewQueue';
import { loadRemotePreview, mergeHltvLiveData } from './remotePreview';

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

describe('mergeHltvLiveData', () => {
  it('keeps loaded player stats when a live refresh has empty rows', () => {
    const previous: OpenGraphPreview = {
      url: 'https://www.hltv.org/matches/1/example',
      title: 'Example',
      description: null,
      image: null,
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv' as const,
        snapshot: {
          startsAt: null,
          teams: [
            { name: 'Alpha', logo: null },
            { name: 'Bravo', logo: null },
          ] as [{ name: string; logo: null }, { name: string; logo: null }],
          status: 'live' as const,
          score: ['0', '1'] as [string, string],
          currentMap: { name: 'Dust2', score: ['6', '13'] as [string, string] },
          completedMaps: [],
          playerStats: [
            [{ nickname: 'one', kills: 10, deaths: 5, assists: 2, adr: 90 }],
            [{ nickname: 'two', kills: 12, deaths: 4, assists: 1, adr: 101 }],
          ],
          teamSides: ['ct', 't'] as ['ct', 't'],
        },
      },
    };
    const previousSnapshot = previous.providerData!.snapshot;
    const next: OpenGraphPreview = {
      ...previous,
      providerData: {
        provider: 'hltv',
        snapshot: {
          ...previousSnapshot,
          playerStats: [[], []] as [never[], never[]],
        },
      },
    };

    expect(mergeHltvLiveData(next, previous).providerData?.snapshot.playerStats)
      .toEqual(previousSnapshot.playerStats);
  });
});
