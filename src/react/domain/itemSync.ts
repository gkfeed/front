import type { FeedItem } from '../types';

export type ItemSnapshot = { items: FeedItem[]; cursor: string };
export type CachedFeedItems = { items: FeedItem[]; cursor?: string };
export type ItemChangesPage = {
  upserted: FeedItem[];
  deletedIds: number[];
  nextCursor: string;
  hasMore: boolean;
};
