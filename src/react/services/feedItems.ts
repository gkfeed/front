import type { Credentials, FeedItem } from '../types';
import {
  authorization,
  endpoint,
  requestJson,
  requireCredentials,
} from './apiClient';
import { parseFeedItemsPage } from './feedSchemas';

const ITEMS_PAGE_SIZE = 100;
const ITEMS_REQUEST_TIMEOUT_MS = 100_000;

export type FeedItemsProgress = (items: FeedItem[]) => boolean | void;

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
    if (onProgress) {
      const shouldContinue = onProgress(
        limit === undefined ? [...items] : items.slice(0, limit),
      );
      if (shouldContinue === false) break;
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
