import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../../types';
import {
  createFeed as createFeedRequest,
  createFeedFromUrl as createFeedFromUrlRequest,
  deleteFeedById,
  deleteFeedItemById,
  getAllFeeds,
  getFeedById,
  getFeedItems,
} from '../../services/feeds';

export async function loadFeeds(
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<Feed[]> {
  return getAllFeeds(credentials, signal);
}

export async function loadFeed(
  id: number | null,
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<Feed> {
  if (id === null) throw new FeedNotFoundError();

  const feed = await getFeedById(id, credentials, signal);
  if (!feed) throw new FeedNotFoundError();
  return feed;
}

export async function loadFeedItems(
  credentials: Credentials | null,
  limit = 1000,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  return getFeedItems(credentials, limit, signal);
}

export function deleteFeedItem(id: number, credentials: Credentials | null): Promise<void> {
  return deleteFeedItemById(id, credentials);
}

export function deleteFeed(id: number, credentials: Credentials | null): Promise<void> {
  return deleteFeedById(id, credentials);
}

export function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<void> {
  return createFeedRequest(feed, credentials);
}

export function createFeedFromUrl(feed: FeedLazyInput, credentials: Credentials | null): Promise<void> {
  return createFeedFromUrlRequest(feed, credentials);
}

export function isFeedNotFoundError(error: unknown): boolean {
  return error instanceof FeedNotFoundError;
}

export class FeedNotFoundError extends Error {
  constructor() {
    super('Feed not found');
    this.name = 'FeedNotFoundError';
  }
}
