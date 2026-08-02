import { getFeedItemPreview } from '../domain/feedItemPreview';
import { getTwitchChannel } from '../domain/twitchPreview';
import type { Credentials, FeedItem } from '../types';
import { getFeedItems } from './feeds';
import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from './requestTimeout';

const OFFLINE_PREVIEW_PATH = /\/404_preview-\d+x\d+\.jpg$/i;
const MAX_CONCURRENT_TWITCH_CHECKS = 4;

export async function getLiveTwitchItems(
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  const items = signal
    ? await getFeedItems(credentials, 1000, signal)
    : await getFeedItems(credentials);
  const twitchItems = deduplicateTwitchItems(items.filter(isTwitchFeedItem));
  const liveStates = await mapWithConcurrency(
    twitchItems,
    (item) => isTwitchStreamLive(item, signal),
    MAX_CONCURRENT_TWITCH_CHECKS,
    signal,
  );

  return twitchItems.filter((_, index) => liveStates[index]);
}

export async function isTwitchStreamLive(item: FeedItem, signal?: AbortSignal): Promise<boolean> {
  const preview = getFeedItemPreview(item);
  if (!preview) return false;

  const timeout = createTimeoutSignal(DEFAULT_REQUEST_TIMEOUT_MS);
  const requestSignal = combineAbortSignals(signal, timeout.signal);
  try {
    const response = await fetch(toProbeUrl(preview.src), {
      cache: 'no-store',
      redirect: 'follow',
      signal: requestSignal,
    });
    if (!response.ok) return false;

    const finalUrl = new URL(response.url);
    return !OFFLINE_PREVIEW_PATH.test(finalUrl.pathname);
  } catch {
    return false;
  } finally {
    timeout.dispose();
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
  maxConcurrent: number,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      if (signal?.aborted) return;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, items.length) }, () => worker()),
  );
  return results;
}

function toProbeUrl(previewUrl: string): string {
  const url = new URL(previewUrl);
  url.pathname = url.pathname.replace(/-\d+x\d+\.jpg$/i, '-440x248.jpg');
  url.searchParams.set('gkfeed-live-check', String(Math.floor(Date.now() / 60_000)));
  return url.href;
}

function isTwitchFeedItem(item: FeedItem): boolean {
  try {
    return getTwitchChannel(new URL(item.link)) !== null;
  } catch {
    return false;
  }
}

function deduplicateTwitchItems(items: readonly FeedItem[]): FeedItem[] {
  const seenChannels = new Set<string>();

  return items.filter((item) => {
    const channel = getTwitchChannel(new URL(item.link));
    if (!channel) return false;

    const channelKey = channel.toLowerCase();
    if (seenChannels.has(channelKey)) return false;
    seenChannels.add(channelKey);
    return true;
  });
}
