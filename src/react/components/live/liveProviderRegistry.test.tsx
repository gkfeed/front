import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHltvLiveIndex } from '../../services/hltvLive';
import { getOpenGraphPreview } from '../../services/openGraph';
import type { FeedItem } from '../../types';
import { catalogCandidates, liveProviderRegistry, mergeCandidates } from './liveProviderRegistry';

vi.mock('../../services/hltvLive');
vi.mock('../../services/openGraph');
vi.mock('../../services/twitch');

beforeEach(() => vi.resetAllMocks());

describe('live provider registry', () => {
  it('recognizes both providers, preserves feed order, and deduplicates provider event IDs', () => {
    const items: FeedItem[] = [
      item(1, 'https://www.twitch.tv/Some_Channel'),
      item(2, 'https://www.hltv.org/matches/2396948/alpha-vs-bravo'),
      item(3, 'https://www.twitch.tv/some_channel?duplicate=1'),
      item(4, 'https://www.hltv.org/matches/2396948/a-second-link'),
      item(5, 'https://example.com/not-live'),
    ];

    expect(catalogCandidates(items, liveProviderRegistry).map(({ providerId, eventId, feedOrder }) => ({ providerId, eventId, feedOrder }))).toEqual([
      { providerId: 'twitch', eventId: 'some_channel', feedOrder: 0 },
      { providerId: 'hltv', eventId: '2396948', feedOrder: 1 },
    ]);
  });

  it('merges later discoveries without changing the existing feed order', () => {
    const first = catalogCandidates([item(1, 'https://www.twitch.tv/first')], liveProviderRegistry, 10);
    const incoming = catalogCandidates([
      item(2, 'https://www.twitch.tv/second'),
      item(3, 'https://www.twitch.tv/first'),
    ], liveProviderRegistry, 20);

    expect(mergeCandidates(first, incoming).map((candidate) => candidate.eventId)).toEqual(['first', 'second']);
  });

  it('sweeps more than 30 dormant HLTV candidates with one index request', async () => {
    const hltv = liveProviderRegistry.find((provider) => provider.id === 'hltv')!;
    const candidates = catalogCandidates(Array.from({ length: 75 }, (_, index) => (
      item(index + 1, `https://www.hltv.org/matches/${2397000 + index}/match`)
    )), liveProviderRegistry);
    vi.mocked(getHltvLiveIndex).mockResolvedValue({ eventIds: ['2397032'] });
    vi.mocked(getOpenGraphPreview).mockResolvedValue({
      url: candidates[32]!.item.link,
      title: 'Alpha vs Bravo',
      description: null,
      image: null,
      video: null,
      siteName: 'HLTV',
      type: null,
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          teams: [{ name: 'Alpha', logo: null }, { name: 'Bravo', logo: null }],
          status: 'live',
          score: ['0', '0'],
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    const result = await hltv.check(candidates, new AbortController().signal);

    expect(getHltvLiveIndex).toHaveBeenCalledOnce();
    expect(getOpenGraphPreview).toHaveBeenCalledOnce();
    expect(result.updates).toHaveLength(75);
    expect(result.updates.filter((update) => update.status === 'live')).toHaveLength(1);
  });

  it('rejects an indexed HLTV match unless its normalized snapshot is exactly live', async () => {
    const hltv = liveProviderRegistry.find((provider) => provider.id === 'hltv')!;
    const candidates = catalogCandidates([item(1, 'https://hltv.org/matches/2397001/match')], liveProviderRegistry);
    vi.mocked(getHltvLiveIndex).mockResolvedValue({ eventIds: ['2397001'] });
    vi.mocked(getOpenGraphPreview).mockResolvedValue({
      url: candidates[0]!.item.link,
      title: null,
      description: null,
      image: null,
      video: null,
      siteName: null,
      type: null,
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          teams: null,
          status: 'scheduled',
          score: null,
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    await expect(hltv.check(candidates, new AbortController().signal)).resolves.toMatchObject({
      updates: [{ status: 'offline' }],
    });
  });
});

function item(id: number, link: string): FeedItem {
  return { id, feedId: 1, link, title: `Item ${id}`, text: '' };
}
