import { getFeedItemPreview } from '../components/feedItemPreview';
import type { Credentials, FeedItem } from '../types';
import { getFeedItems } from './feeds';

const OFFLINE_PREVIEW_PATH = /\/404_preview-\d+x\d+\.jpg$/i;

export async function getLiveTwitchItems(credentials: Credentials | null): Promise<FeedItem[]> {
  const twitchItems = (await getFeedItems(credentials)).filter(isTwitchFeedItem);
  const liveStates = await Promise.all(twitchItems.map(isTwitchStreamLive));

  return twitchItems.filter((_, index) => liveStates[index]);
}

export async function isTwitchStreamLive(item: FeedItem): Promise<boolean> {
  const preview = getFeedItemPreview(item);
  if (!preview) return false;

  const response = await fetch(toProbeUrl(preview.src), {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;

  const finalUrl = new URL(response.url);
  return !OFFLINE_PREVIEW_PATH.test(finalUrl.pathname);
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
