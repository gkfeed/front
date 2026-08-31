import type { Credentials, FeedInput } from '../../types';
import {
  inferFeedSourceFromLazyUrl,
  normalizeLazyFeedUrl,
  trimFeed,
  type FeedCreatorMode,
} from '../../domain/feedCreator';
import type { FeedCommandPort, FeedMetadataPort } from '../featurePorts';

export function createFeedCommandUseCases(
  port: FeedCommandPort,
  metadataPort: FeedMetadataPort,
) {
  function deleteFeedItem(id: number, credentials: Credentials | null): Promise<void> {
    return port.deleteFeedItemById(id, credentials);
  }

  function deleteFeed(id: number, credentials: Credentials | null): Promise<void> {
    return port.deleteFeedById(id, credentials);
  }

  async function saveFeed(
    feed: FeedInput,
    mode: FeedCreatorMode,
    credentials: Credentials | null,
  ): Promise<void> {
    if (mode === 'extended') {
      await port.createFeed(trimFeed(feed), credentials);
      return;
    }

    const inferredSource = inferFeedSourceFromLazyUrl(feed.url);
    if (!inferredSource) {
      await port.createFeedFromUrl({ url: normalizeLazyFeedUrl(feed.url) }, credentials);
      return;
    }

    const metadata = await metadataPort.getOpenGraphPreview(inferredSource.url);
    const title = metadata.title?.trim();
    if (!title) throw new Error('YouTube channel title is unavailable');
    await port.createFeed({ ...inferredSource, title }, credentials);
  }

  return { deleteFeed, deleteFeedItem, saveFeed };
}
