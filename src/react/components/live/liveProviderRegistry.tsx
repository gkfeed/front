import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';

import { isHltvMatchUrl, isOneFootballMatchUrl } from '../../../../shared/urlRules';
import { getOneFootballSnapshot } from '../../../../shared/providerData/oneFootball';
import { OneFootballMatch } from '../previews/OneFootballMatch';
import { HltvMatchup } from '../previews/HltvMatch';
import { TwitchPreview } from '../previews/TwitchPreview';
import { TwitchTitle } from '../TwitchTitle';
import { getFeedItemPreview } from '../../domain/feedItemLocalPreview';
import { getTwitchChannel, getTwitchStreamTitle } from '../../domain/twitchPreview';
import { getHltvLiveIndex } from '../../services/hltvLive';
import { getOpenGraphPreview } from '../../services/openGraph';
import { probeTwitchStreamLive } from '../../services/twitch';
import type { FeedItem } from '../../types';
import type {
  LiveCandidate,
  LiveCheckUpdate,
  LiveCategory,
  LiveEvent,
  LiveProviderRuntime,
} from '../../domain/liveEvents';

export type { LiveCandidate, LiveEvent, LiveEventData } from '../../domain/liveEvents';
export { catalogCandidates, mergeCandidates } from '../../features/live/liveCatalog';

export type LiveProviderAdapter = LiveProviderRuntime & {
  render: (props: {
    event: LiveEvent;
    t: TFunction;
    onPlaybackChange: (isOpen: boolean) => void;
  }) => ReactNode;
};

const STREAMS: LiveCategory = { id: 'streams', titleKey: 'live.streams', order: 10, layout: 'grid' };
const ESPORTS: LiveCategory = { id: 'esports', titleKey: 'live.esports', order: 20, layout: 'list' };

const twitchAdapter: LiveProviderAdapter = {
  id: 'twitch',
  category: STREAMS,
  strategy: 'round-robin',
  refreshIntervalMs: 60_000,
  dormantSweepCycles: 5,
  preserveEndedPlayback: true,
  recognize(item, feedOrder) {
    const url = parseUrl(item.link);
    const channel = url && getTwitchChannel(url);
    if (!channel) return null;
    return candidateFor('twitch', channel.toLowerCase(), `twitch:${channel.toLowerCase()}`, item, feedOrder);
  },
  async check(candidates, signal) {
    const settled = await settleInBatches(candidates, 4, async (candidate) => ({
      candidate,
      live: await probeTwitchStreamLive(candidate.item, signal),
    }));
    const updates: LiveCheckUpdate[] = [];
    let failures = 0;
    for (const result of settled) {
      if (result.status === 'rejected') {
        failures += 1;
        continue;
      }
      const { candidate, live } = result.value;
      const channel = candidate.eventId;
      updates.push(live ? {
        key: candidate.key,
        status: 'live',
        data: {
          kind: 'twitch',
          channel,
          title: getTwitchStreamTitle(candidate.item.title, channel),
        },
      } : { key: candidate.key, status: 'offline' });
    }
    return { updates, failures };
  },
  render({ event, onPlaybackChange }) {
    if (event.data.kind !== 'twitch') return null;
    const preview = getFeedItemPreview(event.candidate.item);
    return (
      <article className="live-event live-event--twitch">
        <TwitchPreview
          channel={event.data.channel}
          preview={preview ? { ...preview, alt: event.candidate.item.title } : null}
          onPreviewError={() => {}}
          isLive={!event.ended}
          onPlayerOpenChange={onPlaybackChange}
        />
        <h3><TwitchTitle text={event.data.title} /></h3>
      </article>
    );
  },
};

const hltvAdapter: LiveProviderAdapter = {
  id: 'hltv',
  category: ESPORTS,
  strategy: 'live-index',
  refreshIntervalMs: 60_000,
  dormantSweepCycles: 1,
  preserveEndedPlayback: false,
  recognize(item, feedOrder) {
    const url = parseUrl(item.link);
    if (!url || !isHltvMatchUrl(url)) return null;
    const eventId = url.pathname.match(/^\/matches\/(\d+)/)?.[1];
    return eventId ? candidateFor('hltv', eventId, `hltv:${eventId}`, item, feedOrder) : null;
  },
  async check(candidates, signal) {
    const liveIds = new Set((await getHltvLiveIndex(signal)).eventIds);
    const updates: LiveCheckUpdate[] = candidates
      .filter((candidate) => !liveIds.has(candidate.eventId))
      .map((candidate) => ({ key: candidate.key, status: 'offline' }));
    const liveCandidates = candidates.filter((candidate) => liveIds.has(candidate.eventId));
    const settled = await settleInBatches(liveCandidates, 4, async (candidate) => ({
      candidate,
      preview: await getOpenGraphPreview(candidate.item.link, signal),
    }));
    let failures = 0;
    for (const result of settled) {
      if (result.status === 'rejected') {
        failures += 1;
        continue;
      }
      const { candidate, preview } = result.value;
      const snapshot = preview.providerData?.provider === 'hltv'
        ? preview.providerData.snapshot
        : null;
      updates.push(snapshot?.status === 'live'
        ? { key: candidate.key, status: 'live', data: { kind: 'hltv', snapshot } }
        : { key: candidate.key, status: 'offline' });
    }
    return { updates, failures };
  },
  render({ event }) {
    if (event.data.kind !== 'hltv' || !event.data.snapshot.teams) return null;
    return (
      <article className="live-event live-event--hltv">
        <HltvMatchup
          teams={event.data.snapshot.teams}
          href={event.candidate.item.link}
          snapshot={event.data.snapshot}
        />
      </article>
    );
  },
};

const oneFootballAdapter: LiveProviderAdapter = {
  id: 'onefootball',
  category: { id: 'football', titleKey: 'live.football', order: 30, layout: 'list', hideWhileLoading: true },
  strategy: 'round-robin',
  // Matches the BFF result-cache TTL. Dormant candidates are swept within five cycles.
  refreshIntervalMs: 60_000,
  dormantSweepCycles: 5,
  preserveEndedPlayback: false,
  recognize(item, feedOrder) {
    const url = parseUrl(item.link);
    if (!url || !isOneFootballMatchUrl(url)) return null;
    const eventId = url.pathname.split('/')[3]!;
    return candidateFor('onefootball', eventId, `onefootball:${eventId}`, item, feedOrder);
  },
  async check(candidates, signal) {
    const settled = await settleInBatches(candidates, 4, async (candidate): Promise<LiveCheckUpdate> => {
      const preview = await getOpenGraphPreview(candidate.item.link, signal);
      const snapshot = getOneFootballSnapshot(preview.providerData);
      return snapshot?.normalizedStatus === 'live'
        ? { key: candidate.key, status: 'live', data: { kind: 'onefootball', snapshot } }
        : { key: candidate.key, status: 'offline' };
    });
    return {
      updates: settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []),
      failures: settled.filter((result) => result.status === 'rejected').length,
    };
  },
  render({ event, t }) {
    if (event.data.kind !== 'onefootball') return null;
    return (
      <article className="live-event live-event--onefootball">
        <OneFootballMatch
          href={event.candidate.item.link}
          snapshot={event.data.snapshot}
          externalLinkHint={t('live.opensInNewTab')}
        />
      </article>
    );
  },
};

export const liveProviderRegistry: readonly LiveProviderAdapter[] = [twitchAdapter, hltvAdapter, oneFootballAdapter];

function candidateFor(
  providerId: string,
  eventId: string,
  deduplicationKey: string,
  item: FeedItem,
  feedOrder: number,
): LiveCandidate {
  return { key: `${providerId}:${eventId}`, providerId, eventId, deduplicationKey, item, feedOrder };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function settleInBatches<T, R>(
  values: readonly T[],
  batchSize: number,
  load: (value: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    results.push(...await Promise.allSettled(values.slice(index, index + batchSize).map(load)));
  }
  return results;
}
