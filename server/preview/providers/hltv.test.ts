import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewError } from '../errors.js';

const fetchHltvHtml = vi.hoisted(() => vi.fn());

vi.mock('../hltvFetcher.js', () => ({ fetchHltvHtml }));

import { hltvOpenGraphAdapter } from './hltv.js';

const matchUrl = new URL('https://www.hltv.org/matches/2396545/bcgame-vs-og');
const preview = {
  url: matchUrl.href,
  title: 'BC.Game vs OG',
  description: null,
  image: null,
  video: null,
  siteName: 'HLTV.org',
  type: null,
  providerData: {
    provider: 'hltv' as const,
    snapshot: {
      startsAt: null,
      teams: [
        { name: 'BC.Game', logo: null },
        { name: 'OG', logo: null },
      ] as [{ name: string; logo: null }, { name: string; logo: null }],
      status: 'over' as const,
      score: ['2', '0'] as [string, string],
      currentMap: null,
      completedMaps: [],
      playerStats: null,
      teamSides: null,
    },
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('HLTV Open Graph provider', () => {
  it('uses a configured fallback when HLTV blocks the local transport', async () => {
    vi.stubEnv('HLTV_PREVIEW_FALLBACK_ORIGIN', 'https://feed.example');
    fetchHltvHtml.mockRejectedValue(new PreviewError(
      'The HLTV page could not be fetched',
      'fetch_failed',
    ));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(preview)));

    await expect(hltvOpenGraphAdapter.fetch(matchUrl)).resolves.toEqual(preview);
    expect(fetch).toHaveBeenCalledWith(
      new URL(`https://feed.example/bff/open-graph?url=${encodeURIComponent(matchUrl.href)}`),
      { headers: { accept: 'application/json' }, signal: undefined },
    );
  });

  it('rejects an invalid fallback response and preserves the local error', async () => {
    vi.stubEnv('HLTV_PREVIEW_FALLBACK_ORIGIN', 'https://feed.example');
    const localError = new PreviewError('The HLTV page could not be fetched', 'fetch_failed');
    fetchHltvHtml.mockRejectedValue(localError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ title: 42 })));

    await expect(hltvOpenGraphAdapter.fetch(matchUrl)).rejects.toBe(localError);
  });
});
