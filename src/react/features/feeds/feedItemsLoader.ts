import type { Credentials, FeedItem } from '../../types';
import type { FeedApplicationPort, FeedItemsCachePort } from '../featurePorts';

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
  feedPort: Pick<FeedApplicationPort, 'getFeedItems'>,
  cachePort: FeedItemsCachePort = NO_FEED_ITEMS_CACHE,
) {
  const cacheRevisions = new Map<string, number>();

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
      void cachePort.write(username, items);
    }
    return items;
  }

  function invalidate(credentials: Credentials | null): void {
    const username = credentials?.username;
    if (!username) return;
    cacheRevisions.set(username, getCacheRevision(username) + 1);
    void cachePort.delete(username);
  }

  return { invalidate, load };

  function getCacheRevision(username: string): number {
    return cacheRevisions.get(username) ?? 0;
  }
}
