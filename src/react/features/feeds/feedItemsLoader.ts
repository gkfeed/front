import type { Credentials, FeedItem } from '../../types';
import type { FeedItemsPort, FeedItemsCachePort } from '../featurePorts';
import type { ItemSnapshot } from '../../domain/itemSync';

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
  const snapshots = new Map<string, ItemSnapshot>();

  function queueCacheOperation(username: string, operation: () => Promise<void>): Promise<void> {
    const previous = cacheOperations.get(username);
    const pending = (previous ? previous.then(operation) : Promise.resolve().then(operation))
      .catch(() => undefined);
    cacheOperations.set(username, pending);
    void pending.then(() => {
      if (cacheOperations.get(username) === pending) cacheOperations.delete(username);
    });
    return pending;
  }

  async function load(
    credentials: Credentials | null,
    { bypassCache = false, signal, onCached, onProgress }: LoadFeedItemsOptions = {},
  ): Promise<FeedItem[]> {
    const username = credentials?.username;
    const revision = username ? getCacheRevision(username) : 0;
    let current = username ? snapshots.get(username) : undefined;

    if (username && !current) {
      await cacheOperations.get(username);
      const cached = await cachePort.read(username);
      if (!signal?.aborted && getCacheRevision(username) === revision && cached) {
        if (!bypassCache) onCached?.(cached.items);
        if (cached.cursor) current = { items: cached.items, cursor: cached.cursor };
      }
    } else if (current && !bypassCache) {
      onCached?.(current.items);
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    if (current) {
      try {
        return (await drainChanges(current)).items;
      } catch (error) {
        if (!isInvalidCursor(error)) throw error;
        // Cursors can expire when the API secret changes.
      }
    }

    return fullSync(true);

    async function fullSync(retryInvalidCursor: boolean): Promise<FeedItem[]> {
      const initial = await feedPort.syncFeedItems(credentials, signal, onProgress, INITIAL_PAGE_SIZE);
      signal?.throwIfAborted();
      if (!initial.cursor) return initial.items;
      await commitSnapshot(initial);
      try {
        return (await drainChanges(initial)).items;
      } catch (error) {
        if (retryInvalidCursor && isInvalidCursor(error)) return fullSync(false);
        throw error;
      }
    }

    async function commitSnapshot(snapshot: ItemSnapshot): Promise<void> {
      if (!username || getCacheRevision(username) !== revision) return;
      await queueCacheOperation(username, () => cachePort.write(username, snapshot));
      if (getCacheRevision(username) === revision) snapshots.set(username, snapshot);
    }

    async function drainChanges(start: ItemSnapshot): Promise<ItemSnapshot> {
      let snapshot = start;
      const seenCursors = new Set<string>();
      while (true) {
        const page = await feedPort.getFeedItemChanges(credentials, snapshot.cursor, signal);
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const itemsById = new Map(snapshot.items.map((item) => [item.id, item]));
        page.upserted.forEach((item) => itemsById.set(item.id, item));
        page.deletedIds.forEach((id) => itemsById.delete(id));
        snapshot = {
          items: [...itemsById.values()].sort((left, right) => right.id - left.id),
          cursor: page.nextCursor,
        };
        await commitSnapshot(snapshot);
        if (!page.hasMore) return snapshot;
        if (seenCursors.has(page.nextCursor)) throw new Error('Invalid API response');
        seenCursors.add(page.nextCursor);
      }
    }
  }

  function invalidate(credentials: Credentials | null): void {
    const username = credentials?.username;
    if (!username) return;
    cacheRevisions.set(username, getCacheRevision(username) + 1);
    snapshots.delete(username);
    void queueCacheOperation(username, () => cachePort.delete(username));
  }

  function remove(credentials: Credentials | null, id: number): void {
    const username = credentials?.username;
    if (!username) return;
    const current = snapshots.get(username);
    if (!current) {
      invalidate(credentials);
      return;
    }
    cacheRevisions.set(username, getCacheRevision(username) + 1);
    const updated = { ...current, items: current.items.filter((item) => item.id !== id) };
    snapshots.set(username, updated);
    void queueCacheOperation(username, () => cachePort.write(username, updated));
  }

  return { invalidate, load, remove };

  function getCacheRevision(username: string): number {
    return cacheRevisions.get(username) ?? 0;
  }
}

function isInvalidCursor(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'status' in error && error.status === 400;
}
