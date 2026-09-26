import type { Credentials, FeedInput } from '../../types';
import {
  inferFeedSourceFromLazyUrl,
  inferFeedTitleFromUrl,
  inferInstagramFeedTitleFromUrl,
  normalizeInstagramFeedUrl,
  normalizeLazyFeedUrl,
  trimFeed,
  type FeedCreatorMode,
} from '../../domain/feedCreator';
import type { FeedCommandPort, FeedMetadataPort, FeedQueryPort } from '../featurePorts';

export function createFeedCommandUseCases(
  port: FeedCommandPort,
  metadataPort: FeedMetadataPort,
  queryPort: FeedQueryPort,
) {
  const suggestFeedType = metadataPort.getFeedTypeSuggestion;
  async function suggestFeedTitle(url: string, signal?: AbortSignal): Promise<string | null> {
    const instagramTitle = inferInstagramFeedTitleFromUrl(url);
    if (instagramTitle) return instagramTitle;

    try {
      const preview = await metadataPort.getOpenGraphPreview(url, signal);
      return preview.title?.trim() || inferFeedTitleFromUrl(url);
    } catch (error) {
      if (signal?.aborted) throw error;
      return inferFeedTitleFromUrl(url);
    }
  }
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
      const normalizedFeed = trimFeed(feed);
      const instagramUsername = normalizedFeed.type === 'inst'
        ? inferInstagramFeedTitleFromUrl(normalizedFeed.url)
        : null;
      if (!instagramUsername) {
        await port.createFeed(normalizedFeed, credentials);
        return;
      }

      const instagramFeed = {
        ...normalizedFeed,
        url: normalizeInstagramFeedUrl(normalizedFeed.url),
      };
      const existingFeeds = await queryPort.getAllFeeds(credentials);
      const exists = (type: string) => existingFeeds.some((existing) => (
        existing.type === type
        && inferInstagramFeedTitleFromUrl(existing.url)?.toLowerCase() === instagramUsername.toLowerCase()
      ));
      if (!exists('inst')) await port.createFeed(instagramFeed, credentials);
      if (!exists('stories')) {
        await port.createFeed({ ...instagramFeed, type: 'stories' }, credentials);
      }
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

  return { deleteFeed, deleteFeedItem, saveFeed, suggestFeedTitle, suggestFeedType };
}
