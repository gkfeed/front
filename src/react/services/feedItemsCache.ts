import { readerDiagnostic } from './readerDiagnostics';
import type { FeedItem } from '../types';
import type { CachedFeedItems } from '../domain/itemSync';
import { normalizeVkWallPostUrl } from '../../../shared/urlRules';

const DATABASE_NAME = 'gkfeed-cache';
const DATABASE_VERSION = 3;
const STORE_NAME = 'feed-items';
const DELETIONS_STORE_NAME = 'feed-item-deletions';
const UPSERTS_STORE_NAME = 'feed-item-upserts';
const ALL_STORES = [STORE_NAME, DELETIONS_STORE_NAME, UPSERTS_STORE_NAME];

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
    const transaction = database.transaction(ALL_STORES, 'readonly');
    const [record, deleted, upserts] = await Promise.all([
      runRequest<unknown>(transaction.objectStore(STORE_NAME).get(username)),
      runRequest<unknown>(transaction.objectStore(DELETIONS_STORE_NAME).get(username)),
      runRequest<unknown[]>(transaction.objectStore(UPSERTS_STORE_NAME).getAll(userItemRange(username))),
    ]);
    if (!isCacheRecord(record)) return undefined;
    const deletedIds = new Set(isDeletionRecord(deleted) ? deleted.ids : []);
    if (!upserts.every(isUpsertRecord)) return undefined;
    const items = new Map(record.items.filter((item) => !deletedIds.has(item.id)).map((item) => [item.id, item]));
    upserts.forEach(({ item }) => { if (!deletedIds.has(item.id)) items.set(item.id, item); });
    const merged = [...items.values()];
    if (upserts.length) merged.sort((a, b) => b.id - a.id);
    return {
      items: merged.map((item) => ({ ...item, link: normalizeVkWallPostUrl(item.link) })),
      ...((isDeletionRecord(deleted) && deleted.cursor) || record.cursor
        ? { cursor: (isDeletionRecord(deleted) && deleted.cursor) || record.cursor } : {}),
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
    if (import.meta.env.DEV) {
      const chars = snapshot.items.reduce((sum, item) => sum + item.text.length, 0);
      readerDiagnostic('cache-snapshot-write', 'unknown', `items=${snapshot.items.length}:chars=${chars}`);
    }
    const transaction = database.transaction(ALL_STORES, 'readwrite');
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORE_NAME).put({
      username,
      savedAt: Date.now(),
      ...snapshot,
    } satisfies FeedItemsCacheRecord);
    transaction.objectStore(DELETIONS_STORE_NAME).delete(username);
    transaction.objectStore(UPSERTS_STORE_NAME).delete(userItemRange(username));
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
    const transaction = database.transaction(ALL_STORES, 'readwrite');
    const completed = transactionCompleted(transaction);
    transaction.objectStore(STORE_NAME).delete(username);
    transaction.objectStore(DELETIONS_STORE_NAME).delete(username);
    transaction.objectStore(UPSERTS_STORE_NAME).delete(userItemRange(username));
    await completed;
  } catch {
    // Caching is an optimization; cleanup failures must not break Reader.
  } finally {
    database.close();
  }
}


/** Record a local deletion without cloning the potentially very large snapshot. */
export async function removeCachedFeedItem(username: string, id: number): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;
  try {
    readerDiagnostic('cache-item-delete', id);
    const transaction = database.transaction([DELETIONS_STORE_NAME, UPSERTS_STORE_NAME], 'readwrite');
    const completed = transactionCompleted(transaction);
    const store = transaction.objectStore(DELETIONS_STORE_NAME);
    transaction.objectStore(UPSERTS_STORE_NAME).delete([username, id]);
    const request = store.get(username);
    request.onsuccess = () => {
      const ids = isDeletionRecord(request.result) ? request.result.ids : [];
      if (!ids.includes(id)) store.put({ ...(isDeletionRecord(request.result) ? request.result : { username }), ids: [...ids, id] });
    };
    await completed;
  } catch {
    // A failed cache update must not prevent deletion on the server.
  } finally {
    database.close();
  }
}

/** Advance an unchanged snapshot's cursor without cloning its items. */
export async function updateCachedFeedCursor(username: string, cursor: string): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;
  try {
    const transaction = database.transaction(DELETIONS_STORE_NAME, 'readwrite');
    const completed = transactionCompleted(transaction);
    const store = transaction.objectStore(DELETIONS_STORE_NAME);
    const request = store.get(username);
    request.onsuccess = () => {
      const record = isDeletionRecord(request.result) ? request.result : { username, ids: [] };
      store.put({ ...record, cursor });
    };
    await completed;
  } catch {
    // The next refresh can replay changes from the previous cursor.
  } finally {
    database.close();
  }
}

/** Save changed items, removals and the next cursor in one transaction. */
export async function applyCachedFeedChanges(
  username: string, upserted: FeedItem[], deletedIds: number[], cursor: string,
): Promise<void> {
  const database = await openCacheDatabase();
  if (!database) return;
  try {
    if (import.meta.env.DEV) readerDiagnostic('cache-page-write', 'unknown', `upserts=${upserted.length}:deletes=${deletedIds.length}`);
    const transaction = database.transaction([DELETIONS_STORE_NAME, UPSERTS_STORE_NAME], 'readwrite');
    const completed = transactionCompleted(transaction);
    const metadata = transaction.objectStore(DELETIONS_STORE_NAME);
    const items = transaction.objectStore(UPSERTS_STORE_NAME);
    const request = metadata.get(username);
    request.onsuccess = () => {
      const deleted = new Set(isDeletionRecord(request.result) ? request.result.ids : []);
      for (const item of upserted) {
        deleted.delete(item.id);
        items.put({ username, id: item.id, item });
      }
      for (const id of deletedIds) {
        deleted.add(id);
        items.delete([username, id]);
      }
      metadata.put({ username, ids: [...deleted], cursor });
    };
    await completed;
  } catch {
    // Replaying a change page is safe if this optimization cannot be saved.
  } finally {
    database.close();
  }
}

function userItemRange(username: string): IDBKeyRange {
  return IDBKeyRange.bound([username, 0], [username, Number.MAX_SAFE_INTEGER]);
}

function isUpsertRecord(value: unknown): value is { username: string; id: number; item: FeedItem } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { username?: unknown; id?: unknown; item?: unknown };
  return typeof record.username === 'string' && isFeedItem(record.item)
    && record.id === record.item.id;
}

function isDeletionRecord(value: unknown): value is { username: string; ids: number[]; cursor?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { username?: unknown; ids?: unknown; cursor?: unknown };
  return typeof record.username === 'string' && (record.cursor === undefined || (typeof record.cursor === 'string' && record.cursor.length > 0))
    && Array.isArray(record.ids)
    && record.ids.every((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0);
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
      if (!request.result.objectStoreNames.contains(DELETIONS_STORE_NAME)) {
        request.result.createObjectStore(DELETIONS_STORE_NAME, { keyPath: 'username' });
      }
      if (!request.result.objectStoreNames.contains(UPSERTS_STORE_NAME)) {
        request.result.createObjectStore(UPSERTS_STORE_NAME, { keyPath: ['username', 'id'] });
      }
    };
    let settled = false;
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (settled) { database.close(); return; }
      settled = true;
      resolve(database);
    };
    request.onerror = () => { if (!settled) { settled = true; resolve(undefined); } };
    request.onblocked = () => { if (!settled) { settled = true; resolve(undefined); } };
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
