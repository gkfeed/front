import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../../types';
import type { FeedApplicationPort } from '../featurePorts';

export function createFeedUseCases(port: FeedApplicationPort) {
  async function loadFeeds(
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Feed[]> {
    return port.getAllFeeds(credentials, signal);
  }

  async function loadFeed(
    id: number | null,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Feed> {
    if (id === null) throw new FeedNotFoundError();

    const feed = await port.getFeedById(id, credentials, signal);
    if (!feed) throw new FeedNotFoundError();
    return feed;
  }

  function loadFeedItems(
    credentials: Credentials | null,
    limit?: number,
    signal?: AbortSignal,
    onProgress?: (items: FeedItem[]) => boolean | void,
    initialPageSize?: number,
  ): Promise<FeedItem[]> {
    return port.getFeedItems(credentials, limit, signal, onProgress, initialPageSize);
  }

  function deleteFeedItem(id: number, credentials: Credentials | null): Promise<void> {
    return port.deleteFeedItemById(id, credentials);
  }

  function deleteFeed(id: number, credentials: Credentials | null): Promise<void> {
    return port.deleteFeedById(id, credentials);
  }

  function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<void> {
    return port.createFeed(feed, credentials);
  }

  function createFeedFromUrl(feed: FeedLazyInput, credentials: Credentials | null): Promise<void> {
    return port.createFeedFromUrl(feed, credentials);
  }

  function isFeedNotFoundError(error: unknown): boolean {
    return error instanceof FeedNotFoundError;
  }

  return {
    createFeed,
    createFeedFromUrl,
    deleteFeed,
    deleteFeedItem,
    isFeedNotFoundError,
    loadFeed,
    loadFeedItems,
    loadFeeds,
  };
}

export class FeedNotFoundError extends Error {
  constructor() {
    super('Feed not found');
    this.name = 'FeedNotFoundError';
  }
}
