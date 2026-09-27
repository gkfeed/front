import type { Credentials, FeedItem } from '../types';
import type { ItemSnapshot } from '../domain/itemSync';
import { authorization, itemsEndpoint, requestJson, requireCredentials } from './apiClient';
import { parseItemChangesPage, parseItemsSyncPage } from './feedSchemas';

const ITEMS_PAGE_SIZE = 100;
const ITEMS_REQUEST_TIMEOUT_MS = 100_000;

export type FeedItemsProgress = (items: FeedItem[]) => boolean | void;
export type FeedItemsResult = FeedItem[] & { syncCursor?: string };

export async function syncFeedItems(
  credentials: Credentials | null,
  signal?: AbortSignal,
  onProgress?: FeedItemsProgress,
  initialPageSize = ITEMS_PAGE_SIZE,
  limit?: number,
): Promise<ItemSnapshot> {
  if (!Number.isSafeInteger(initialPageSize) || initialPageSize <= 0 || initialPageSize > 500) {
    throw new Error('Invalid initialPageSize');
  }
  const headers = authorization(requireCredentials(credentials));
  const items: FeedItem[] = [];
  const seenCursors = new Set<string>();
  let pageCursor: string | undefined;
  let syncCursor: string | undefined;

  for (;;) {
    const requestedPageSize = pageCursor ? ITEMS_PAGE_SIZE : initialPageSize;
    const pageLimit = limit === undefined
      ? requestedPageSize
      : Math.min(requestedPageSize, limit - items.length);
    const query = new URLSearchParams({ limit: String(pageLimit) });
    if (pageCursor) query.set('cursor', pageCursor);
    const response = await requestJson(itemsEndpoint(`sync?${query}`), {
      headers,
      ...(signal ? { signal } : {}),
    }, { timeoutMs: ITEMS_REQUEST_TIMEOUT_MS });
    const page = parseItemsSyncPage(response);
    syncCursor ??= page.syncCursor;
    items.push(...page.items);
    if (onProgress?.([...items]) === false) break;
    if (!page.hasMore || (limit !== undefined && items.length >= limit)) break;
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) throw new Error('Invalid API response');
    seenCursors.add(page.nextCursor);
    pageCursor = page.nextCursor;
  }

  if (!syncCursor) throw new Error('Invalid API response');
  return { items: limit === undefined ? items : items.slice(0, limit), cursor: syncCursor };
}

export async function getFeedItemChanges(
  credentials: Credentials | null,
  cursor: string,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ cursor, limit: String(ITEMS_PAGE_SIZE) });
  const response = await requestJson(itemsEndpoint(`changes?${query}`), {
    headers: authorization(requireCredentials(credentials)),
    ...(signal ? { signal } : {}),
  }, { timeoutMs: ITEMS_REQUEST_TIMEOUT_MS });
  return parseItemChangesPage(response);
}

// Live views still request a bounded snapshot. The Reader uses the cursor as well.
export async function getFeedItems(
  credentials: Credentials | null,
  limit?: number,
  signal?: AbortSignal,
  onProgress?: FeedItemsProgress,
  initialPageSize = ITEMS_PAGE_SIZE,
): Promise<FeedItemsResult> {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) return [];
  const snapshot = await syncFeedItems(credentials, signal, onProgress, initialPageSize, limit);
  Object.defineProperty(snapshot.items, 'syncCursor', { value: snapshot.cursor });
  return snapshot.items;
}
