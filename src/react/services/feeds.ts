import type { Credentials, Feed, FeedInput, FeedLazyInput } from '../types';
import {
  authorization,
  endpoint,
  postJson,
  request,
  requestJson,
  requireCredentials,
} from './apiClient';
import { parseFeeds } from './feedSchemas';

export { getFeedItems, type FeedItemsProgress } from './feedItems';

export { ApiError } from './apiClient';

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
