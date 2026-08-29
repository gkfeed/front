import type { FeedItem } from '../types';

const DATABASE_NAME = 'gkfeed-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'feed-items';

type FeedItemsCacheRecord = {
  username: string;
  savedAt: number;
  items: FeedItem[];
};

export async function readFeedItemsCache(
  username: string,
  maxAgeMs: number,
): Promise<FeedItem[] | undefined> {
  const database = await openCacheDatabase();
  if (!database) return undefined;

  try {
    const record = await runRequest<unknown>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(username),
    );
    if (!isCacheRecord(record) || Date.now() - record.savedAt > maxAgeMs) return undefined;
    return record.items;
  } catch {
    return undefined;
  } finally {
    database.close();
  }
}

export async function writeFeedItemsCache(username: string, items: FeedItem[]): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;

  try {
    await runRequest(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      username,
      savedAt: Date.now(),
      items,
    } satisfies FeedItemsCacheRecord));
  } catch {
    // Caching is an optimization; quota and privacy-mode failures must not break Reader.
  } finally {
    database.close();
  }
}

export async function deleteFeedItemsCache(username: string): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;

  try {
    await runRequest(
      database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(username),
    );
  } catch {
    // Caching is an optimization; cleanup failures must not break Reader.
  } finally {
    database.close();
  }
}

function openCacheDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(undefined);
      return;
    }

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'username' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
    request.onblocked = () => resolve(undefined);
  });
}

function runRequest<T = IDBValidKey>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function isCacheRecord(value: unknown): value is FeedItemsCacheRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<FeedItemsCacheRecord>;
  return typeof record.username === 'string'
    && typeof record.savedAt === 'number'
    && Number.isFinite(record.savedAt)
    && Array.isArray(record.items)
    && record.items.every(isFeedItem);
}

function isFeedItem(value: unknown): value is FeedItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<FeedItem>;
  return typeof item.id === 'number'
    && Number.isSafeInteger(item.id)
    && typeof item.feedId === 'number'
    && Number.isSafeInteger(item.feedId)
    && typeof item.link === 'string'
    && typeof item.title === 'string'
    && typeof item.text === 'string';
}
