import type { FeedItem } from '../types';
import type { CachedFeedItems } from '../domain/itemSync';
import { normalizeVkWallPostUrl } from '../../../shared/urlRules';

const DATABASE_NAME = 'gkfeed-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'feed-items';

type FeedItemsCacheRecord = {
  username: string;
  savedAt: number;
  items: FeedItem[];
  cursor?: string;
};

export async function readFeedItemsCache(
  username: string,
): Promise<CachedFeedItems | undefined> {
  const database = await openCacheDatabase();
  if (!database) return undefined;

  try {
    const record = await runRequest<unknown>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(username),
    );
    if (!isCacheRecord(record)) return undefined;
    return {
      items: record.items.map((item) => ({ ...item, link: normalizeVkWallPostUrl(item.link) })),
      ...(record.cursor ? { cursor: record.cursor } : {}),
    };
  } catch {
    return undefined;
  } finally {
    database.close();
  }
}

export async function writeFeedItemsCache(username: string, snapshot: CachedFeedItems): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORE_NAME).put({
      username,
      savedAt: Date.now(),
      ...snapshot,
    } satisfies FeedItemsCacheRecord);
    await completed;
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
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORE_NAME).delete(username);
    await completed;
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

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function isCacheRecord(value: unknown): value is FeedItemsCacheRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<FeedItemsCacheRecord>;
  return typeof record.username === 'string'
    && typeof record.savedAt === 'number'
    && Number.isFinite(record.savedAt)
    && (record.cursor === undefined || (typeof record.cursor === 'string' && record.cursor.length > 0))
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
