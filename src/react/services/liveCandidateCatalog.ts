import type { LiveCandidate } from '../domain/liveEvents';

const DATABASE_NAME = 'gkfeed-live';
const DATABASE_VERSION = 1;
const STORE_NAME = 'catalogs';

export type LiveCandidateCatalog = {
  candidates: LiveCandidate[];
  lastReconciledAt: number | null;
  newestItemId: number | null;
};

type CatalogRecord = LiveCandidateCatalog & { username: string };

export async function readLiveCandidateCatalog(username: string): Promise<LiveCandidateCatalog | undefined> {
  const database = await openDatabase();
  if (!database) return undefined;
  try {
    const value = await requestValue<unknown>(
      database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(username),
    );
    return isCatalogRecord(value)
      ? {
        candidates: value.candidates,
        lastReconciledAt: value.lastReconciledAt,
        newestItemId: value.newestItemId,
      }
      : undefined;
  } catch {
    return undefined;
  } finally {
    database.close();
  }
}

export async function writeLiveCandidateCatalog(
  username: string,
  catalog: LiveCandidateCatalog,
): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  try {
    await requestValue(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      username,
      ...catalog,
    } satisfies CatalogRecord));
  } catch {
    // The catalog improves startup, but storage failures must not break the page.
  } finally {
    database.close();
  }
}

function openDatabase(): Promise<IDBDatabase | undefined> {
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

function requestValue<T = IDBValidKey>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function isCatalogRecord(value: unknown): value is CatalogRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<CatalogRecord>;
  return typeof record.username === 'string'
    && (record.lastReconciledAt === null || typeof record.lastReconciledAt === 'number')
    && (record.newestItemId === null || Number.isSafeInteger(record.newestItemId))
    && Array.isArray(record.candidates)
    && record.candidates.every(isCandidate);
}

function isCandidate(value: unknown): value is LiveCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LiveCandidate>;
  return typeof candidate.key === 'string'
    && typeof candidate.providerId === 'string'
    && typeof candidate.eventId === 'string'
    && typeof candidate.deduplicationKey === 'string'
    && Number.isSafeInteger(candidate.feedOrder)
    && isFeedItem(candidate.item);
}

function isFeedItem(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.id)
    && Number.isSafeInteger(item.feedId)
    && typeof item.link === 'string'
    && typeof item.title === 'string'
    && typeof item.text === 'string';
}
