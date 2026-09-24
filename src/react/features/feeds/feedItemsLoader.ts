import type { Credentials, FeedItem } from '../../types';
import type { FeedItemsPort, FeedItemsCachePort } from '../featurePorts';

const CACHE_FRESHNESS_MS = 15_000;
const INITIAL_PAGE_SIZE = 10;

export type LoadFeedItemsOptions = {
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

export function createFeedItemsLoader(
  feedPort: FeedItemsPort,
  cachePort: FeedItemsCachePort = NO_FEED_ITEMS_CACHE,
) {
  const cacheRevisions = new Map<string, number>();
  const cacheOperations = new Map<string, Promise<void>>();

  function queueCacheOperation(username: string, operation: () => Promise<void>): void {
    const previous = cacheOperations.get(username);
    const pending = (previous ? previous.then(operation) : Promise.resolve().then(operation))
      .catch(() => undefined);
    cacheOperations.set(username, pending);
    void pending.then(() => {
      if (cacheOperations.get(username) === pending) cacheOperations.delete(username);
    });
  }

  async function load(
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
      await cacheOperations.get(username);
      const cachedItems = await cachePort.read(username, CACHE_FRESHNESS_MS);
      if (!signal?.aborted && getCacheRevision(username) === cacheRevision && cachedItems) {
        onCached?.(cachedItems);
      }
    }

    const items = await feedPort.getFeedItems(
      credentials,
      undefined,
      signal,
      onProgress,
      INITIAL_PAGE_SIZE,
    );
    if (!signal?.aborted && username && getCacheRevision(username) === cacheRevision) {
      queueCacheOperation(username, () => cachePort.write(username, items));
    }
    return items;
  }

  function invalidate(credentials: Credentials | null): void {
    const username = credentials?.username;
    if (!username) return;
    cacheRevisions.set(username, getCacheRevision(username) + 1);
    queueCacheOperation(username, () => cachePort.delete(username));
  }

  return { invalidate, load };

  function getCacheRevision(username: string): number {
    return cacheRevisions.get(username) ?? 0;
  }
}
