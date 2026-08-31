import type {
  FeedItemsCachePort,
  FeedMetadataPort,
  FeedCommandPort,
  FeedItemsPort,
  FeedQueryPort,
} from '../featurePorts';
import { createFeedCommandUseCases } from './feedCommands';
import { createFeedItemsLoader } from './feedItemsLoader';
import { createFeedQueryUseCases, FeedNotFoundError } from './feedQueries';

export type FeedUseCaseDependencies = {
  queryPort: FeedQueryPort;
  itemsPort: FeedItemsPort;
  commandPort: FeedCommandPort;
  metadataPort: FeedMetadataPort;
  cachePort?: FeedItemsCachePort;
};

/** Composes feed queries, commands, and item loading into the feature contract. */
export function createFeedUseCases({
  queryPort,
  itemsPort,
  commandPort,
  metadataPort,
  cachePort,
}: FeedUseCaseDependencies) {
  const feedItems = createFeedItemsLoader(itemsPort, cachePort);

  return {
    ...createFeedQueryUseCases(queryPort),
    ...createFeedCommandUseCases(commandPort, metadataPort),
    invalidateFeedItemsCache: feedItems.invalidate,
    loadFeedItems: feedItems.load,
  };
}

export { FeedNotFoundError };
