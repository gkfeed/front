import type { Credentials, Feed } from '../../types';
import type { FeedQueryPort } from '../featurePorts';

export function createFeedQueryUseCases(port: FeedQueryPort) {
  async function loadFeeds(
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Feed[]> {
    return port.getAllFeeds(credentials, signal);
  }

  async function loadFeed(
    id: number | null,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Feed> {
    if (id === null) throw new FeedNotFoundError();

    const feed = await port.getFeedById(id, credentials, signal);
    if (!feed) throw new FeedNotFoundError();
    return feed;
  }

  function isFeedNotFoundError(error: unknown): boolean {
    return error instanceof FeedNotFoundError;
  }

  return { isFeedNotFoundError, loadFeed, loadFeeds };
}

export class FeedNotFoundError extends Error {
  constructor() {
    super('Feed not found');
    this.name = 'FeedNotFoundError';
  }
}
