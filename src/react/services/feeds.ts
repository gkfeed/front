import type { Credentials, Feed, FeedInput, FeedLazyInput, FeedItem } from '../types';
import {
  authorization,
  endpoint,
  postJson,
  request,
  requestJson,
  requireCredentials,
} from './apiClient';
import { parseFeedItemsPage, parseFeeds } from './feedSchemas';
const ITEMS_PAGE_SIZE = 100;
const ITEMS_REQUEST_TIMEOUT_MS = 100_000;

export type FeedItemsProgress = (items: FeedItem[]) => boolean | void;

export { ApiError } from './apiClient';
export { validateCredentials } from './auth';

export async function getAllFeeds(credentials: Credentials | null, signal?: AbortSignal): Promise<Feed[]> {
  const response = await requestJson(endpoint('list'), {
    headers: authorization(requireCredentials(credentials)),
    ...(signal ? { signal } : {}),
  });
  return parseFeeds(response);
}

export async function getFeedById(
  id: number,
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<Feed | undefined> {
  return (await getAllFeeds(credentials, signal)).find((feed) => feed.id === id);
}

export async function getFeedItems(
  credentials: Credentials | null,
  limit?: number,
  signal?: AbortSignal,
  onProgress?: FeedItemsProgress,
  initialPageSize = ITEMS_PAGE_SIZE,
): Promise<FeedItem[]> {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit <= 0)) return [];
  if (!Number.isSafeInteger(initialPageSize) || initialPageSize <= 0) {
    throw new Error('Invalid initialPageSize');
  }

  const headers = authorization(requireCredentials(credentials));
  const items: FeedItem[] = [];
  const seenCursors = new Set<number>();
  const progressCallback = onProgress;
  let cursor: number | undefined;

  while (limit === undefined || items.length < limit) {
    const requestedPageSize = cursor === undefined ? initialPageSize : ITEMS_PAGE_SIZE;
    const pageLimit = limit === undefined
      ? requestedPageSize
      : Math.min(requestedPageSize, limit - items.length);
    const query = new URLSearchParams({ limit: String(pageLimit) });
    if (cursor !== undefined) query.set('cursor', String(cursor));

    const response = await requestJson(endpoint(`get_items?${query}`), {
      headers,
      ...(signal ? { signal } : {}),
    }, { timeoutMs: ITEMS_REQUEST_TIMEOUT_MS });
    const page = parseFeedItemsPage(response);
    items.push(...page.items);
    if (progressCallback) {
      const shouldContinue = progressCallback(
        limit === undefined ? [...items] : items.slice(0, limit),
      );
      if (shouldContinue === false) {
        // Caller requested to stop paging after the current page.
        break;
      }
    }

    // A broken upstream can keep returning empty pages with new cursors.
    // There is no useful progress to make once a page contains no items.
    if (page.items.length === 0 || page.nextCursor === undefined) break;
    if (seenCursors.has(page.nextCursor)) throw new Error('Invalid API response');
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  return limit === undefined ? items : items.slice(0, limit);
}

export async function deleteFeedItemById(id: number, credentials: Credentials | null): Promise<void> {
  await request(endpoint('add_deleted_items'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authorization(requireCredentials(credentials)),
    },
    body: JSON.stringify({ itemIds: [id] }),
  });
}

export async function deleteFeedById(id: number, credentials: Credentials | null): Promise<void> {
  await request(endpoint(`delete?id=${id}`), {
    method: 'DELETE',
    headers: authorization(requireCredentials(credentials)),
  });
}

export async function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<void> {
  await postJson('add', feed, credentials);
}

export async function createFeedFromUrl(feed: FeedLazyInput, credentials: Credentials | null): Promise<void> {
  await postJson('add_lazy', feed, credentials);
}
