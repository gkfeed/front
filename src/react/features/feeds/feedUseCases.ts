import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../../types';
import {
  inferFeedSourceFromLazyUrl,
  normalizeLazyFeedUrl,
  trimFeed,
  type FeedCreatorMode,
} from '../../domain/feedCreator';
import type { FeedApplicationPort, FeedMetadataPort } from '../featurePorts';

export function createFeedUseCases(port: FeedApplicationPort, metadataPort: FeedMetadataPort) {
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

  async function saveFeed(
    feed: FeedInput,
    mode: FeedCreatorMode,
    credentials: Credentials | null,
  ): Promise<void> {
    if (mode === 'extended') {
      await createFeed(trimFeed(feed), credentials);
      return;
    }

    const inferredSource = inferFeedSourceFromLazyUrl(feed.url);
    if (!inferredSource) {
      await createFeedFromUrl({ url: normalizeLazyFeedUrl(feed.url) }, credentials);
      return;
    }

    const metadata = await metadataPort.getOpenGraphPreview(inferredSource.url);
    const title = metadata.title?.trim();
    if (!title) throw new Error('YouTube channel title is unavailable');
    await createFeed({ ...inferredSource, title }, credentials);
  }

  function isFeedNotFoundError(error: unknown): boolean {
    return error instanceof FeedNotFoundError;
  }

  return {
    deleteFeed,
    deleteFeedItem,
    isFeedNotFoundError,
    loadFeed,
    loadFeedItems,
    loadFeeds,
    saveFeed,
  };
}

export class FeedNotFoundError extends Error {
  constructor() {
    super('Feed not found');
    this.name = 'FeedNotFoundError';
  }
}
