import type { Credentials, FeedItem } from '../types';
import { getFeedItems } from './feeds';
import { findLiveTwitchItems } from './twitchLiveProbe';

export { isTwitchStreamLive } from './twitchLiveProbe';
export { probeTwitchStreamLive } from './twitchLiveProbe';

export async function getLiveTwitchItems(
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  const items = signal
    ? await getFeedItems(credentials, 1000, signal)
    : await getFeedItems(credentials);
  return findLiveTwitchItems(items, signal);
}
