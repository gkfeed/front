import type { Feed } from '../../types';

export function filterFeeds(feeds: readonly Feed[], normalizedQuery: string): Feed[] {
  if (!normalizedQuery) return [...feeds];

  return feeds.filter((feed) => (
    `${feed.title} ${feed.type} ${feed.url}`.toLowerCase().includes(normalizedQuery)
  ));
}
