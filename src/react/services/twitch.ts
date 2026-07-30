import { getFeedItemPreview } from '../domain/feedItemPreview';
import type { Credentials, FeedItem } from '../types';
import { getFeedItems } from './feeds';

const OFFLINE_PREVIEW_PATH = /\/404_preview-\d+x\d+\.jpg$/i;
const MAX_CONCURRENT_TWITCH_CHECKS = 4;

export async function getLiveTwitchItems(
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  const items = signal
    ? await getFeedItems(credentials, 1000, signal)
    : await getFeedItems(credentials);
  const twitchItems = items.filter(isTwitchFeedItem);
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

  try {
    const response = await fetch(toProbeUrl(preview.src), {
      cache: 'no-store',
      redirect: 'follow',
      signal: signal ?? AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;

    const finalUrl = new URL(response.url);
    return !OFFLINE_PREVIEW_PATH.test(finalUrl.pathname);
  } catch {
    return false;
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
    const hostname = new URL(item.link).hostname.replace(/^www\./, '').toLowerCase();
    return hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv');
  } catch {
    return false;
  }
}
