import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../../types';
import {
  inferFeedSourceFromLazyUrl,
  normalizeLazyFeedUrl,
  trimFeed,
  type FeedCreatorMode,
} from '../../domain/feedCreator';
import type {
  FeedApplicationPort,
  FeedItemsCachePort,
  FeedMetadataPort,
} from '../featurePorts';

const CACHE_FRESHNESS_MS = 15_000;
const INITIAL_PAGE_SIZE = 10;

type LoadFeedItemsOptions = {
  bypassCache?: boolean;
  signal?: AbortSignal;
  onCached?: (items: FeedItem[]) => void;
  onProgress?: (items: FeedItem[]) => boolean | void;
};

const NO_FEED_ITEMS_CACHE: FeedItemsCachePort = {
  read: async () => undefined,
  write: async () => undefined,
  delete: async () => undefined,
};

export function createFeedUseCases(
  port: FeedApplicationPort,
  metadataPort: FeedMetadataPort,
  cachePort: FeedItemsCachePort = NO_FEED_ITEMS_CACHE,
) {
  const cacheRevisions = new Map<string, number>();
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

  async function loadFeedItems(
    credentials: Credentials | null,
    {
      bypassCache = false,
      signal,
      onCached,
      onProgress,
    }: LoadFeedItemsOptions = {},
  ): Promise<FeedItem[]> {
    const username = credentials?.username;
    const cacheRevision = username ? getCacheRevision(username) : 0;

    if (!bypassCache && username) {
      const cachedItems = await cachePort.read(username, CACHE_FRESHNESS_MS);
      if (
        !signal?.aborted
        && getCacheRevision(username) === cacheRevision
        && cachedItems
      ) {
        onCached?.(cachedItems);
      }
    }

    const items = await port.getFeedItems(
      credentials,
      undefined,
      signal,
      onProgress,
      INITIAL_PAGE_SIZE,
    );
    if (!signal?.aborted && username && getCacheRevision(username) === cacheRevision) {
      void cachePort.write(username, items);
    }
    return items;
  }

  function invalidateFeedItemsCache(credentials: Credentials | null): void {
    const username = credentials?.username;
    if (!username) return;
    cacheRevisions.set(username, getCacheRevision(username) + 1);
    void cachePort.delete(username);
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
    invalidateFeedItemsCache,
    isFeedNotFoundError,
    loadFeed,
    loadFeedItems,
    loadFeeds,
    saveFeed,
  };

  function getCacheRevision(username: string): number {
    return cacheRevisions.get(username) ?? 0;
  }
}

export class FeedNotFoundError extends Error {
  constructor() {
    super('Feed not found');
    this.name = 'FeedNotFoundError';
  }
}
