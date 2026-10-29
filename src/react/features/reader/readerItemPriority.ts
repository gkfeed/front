import { feedPluginCatalog, getFeedItemProvider } from '../../domain/feedItemProviderPresentation';
import type { Feed, FeedItem } from '../../types';

const liveProviders: ReadonlySet<string> = new Set(feedPluginCatalog.filter(({ live }) => live).map(({ id }) => id));

export function getPriorityReaderItemIds(
  items: readonly FeedItem[],
  feeds: readonly Feed[],
): ReadonlySet<number> {
  const storyFeedIds = new Set(feeds
    .filter(({ type }) => type.trim().toLowerCase() === 'stories')
    .map(({ id }) => id));

  return new Set(items
    .filter((item) => storyFeedIds.has(item.feedId) || liveProviders.has(getFeedItemProvider(item)))
    .map(({ id }) => id));
}
