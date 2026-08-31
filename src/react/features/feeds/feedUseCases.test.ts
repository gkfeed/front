import { describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { FeedItem } from '../../types';
import type {
  FeedApplicationPort,
  FeedItemsCachePort,
  FeedMetadataPort,
} from '../featurePorts';
import { createFeedUseCases } from './feedUseCases';

const credentials = { username: 'reader', password: 'secret' };
const cachedItem: FeedItem = {
  id: 1,
  feedId: 1,
  link: 'https://example.com/cached',
  title: 'Cached',
  text: '',
};
const currentItem: FeedItem = {
  ...cachedItem,
  id: 2,
  link: 'https://example.com/current',
  title: 'Current',
};

describe('feed use cases', () => {
  it('owns stale-while-revalidate cache policy for feed items', async () => {
    const { port, metadataPort, cachePort } = createPorts();
    vi.mocked(cachePort.read).mockResolvedValue([cachedItem]);
    vi.mocked(port.getFeedItems).mockResolvedValue([currentItem]);
    const onCached = vi.fn();
    const onProgress = vi.fn();
    const useCases = createFeedUseCases(port, metadataPort, cachePort);

    await expect(useCases.loadFeedItems(credentials, { onCached, onProgress }))
      .resolves.toEqual([currentItem]);

    expect(cachePort.read).toHaveBeenCalledWith('reader', 15_000);
    expect(onCached).toHaveBeenCalledWith([cachedItem]);
    expect(port.getFeedItems).toHaveBeenCalledWith(
      credentials,
      undefined,
      undefined,
      onProgress,
      10,
    );
    expect(cachePort.write).toHaveBeenCalledWith('reader', [currentItem]);
  });

  it('prevents an invalidated in-flight load from restoring stale cache data', async () => {
    const { port, metadataPort, cachePort } = createPorts();
    let finishLoad!: (items: FeedItem[]) => void;
    vi.mocked(port.getFeedItems).mockImplementation(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const useCases = createFeedUseCases(port, metadataPort, cachePort);

    const load = useCases.loadFeedItems(credentials);
    await vi.waitFor(() => expect(port.getFeedItems).toHaveBeenCalledOnce());
    useCases.invalidateFeedItemsCache(credentials);
    finishLoad([currentItem]);
    await load;

    expect(cachePort.delete).toHaveBeenCalledWith('reader');
    expect(cachePort.write).not.toHaveBeenCalled();
  });

  it('does not publish a cache read that was invalidated before it completed', async () => {
    const { port, metadataPort, cachePort } = createPorts();
    let finishCacheRead!: (items: FeedItem[]) => void;
    vi.mocked(cachePort.read).mockImplementation(() => new Promise((resolve) => {
      finishCacheRead = resolve;
    }));
    vi.mocked(port.getFeedItems).mockResolvedValue([currentItem]);
    const onCached = vi.fn();
    const useCases = createFeedUseCases(port, metadataPort, cachePort);

    const load = useCases.loadFeedItems(credentials, { onCached });
    await vi.waitFor(() => expect(cachePort.read).toHaveBeenCalledOnce());
    useCases.invalidateFeedItemsCache(credentials);
    finishCacheRead([cachedItem]);
    await load;

    expect(onCached).not.toHaveBeenCalled();
    expect(cachePort.write).not.toHaveBeenCalled();
  });

  it('normalizes URL-only feed creation', async () => {
    const { port, metadataPort } = createPorts();
    const useCases = createFeedUseCases(port, metadataPort);

    await useCases.saveFeed({
      title: '',
      type: 'web',
      url: '  https://example.com/feed.xml  ',
    }, 'lazy', credentials);

    expect(port.createFeedFromUrl).toHaveBeenCalledWith(
      { url: 'https://example.com/feed.xml' },
      credentials,
    );
    expect(port.createFeed).not.toHaveBeenCalled();
    expect(metadataPort.getOpenGraphPreview).not.toHaveBeenCalled();
  });

  it('resolves canonical YouTube channel metadata before creation', async () => {
    const preview = createOpenGraphPreview('  Fresh Technologies  ');
    const { port, metadataPort } = createPorts(preview);
    const useCases = createFeedUseCases(port, metadataPort);

    await useCases.saveFeed({
      title: '',
      type: 'web',
      url: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ?si=shared',
    }, 'lazy', credentials);

    const canonicalUrl = 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ';
    expect(metadataPort.getOpenGraphPreview).toHaveBeenCalledWith(canonicalUrl);
    expect(port.createFeed).toHaveBeenCalledWith({
      title: 'Fresh Technologies',
      type: 'yt',
      url: canonicalUrl,
    }, credentials);
    expect(port.createFeedFromUrl).not.toHaveBeenCalled();
  });

  it('trims manual feed input without loading metadata', async () => {
    const { port, metadataPort } = createPorts();
    const useCases = createFeedUseCases(port, metadataPort);

    await useCases.saveFeed({
      title: '  News  ',
      type: '  web  ',
      url: '  https://example.com/feed.xml  ',
    }, 'extended', null);

    expect(port.createFeed).toHaveBeenCalledWith({
      title: 'News',
      type: 'web',
      url: 'https://example.com/feed.xml',
    }, null);
    expect(metadataPort.getOpenGraphPreview).not.toHaveBeenCalled();
  });
});

function createPorts(preview = createOpenGraphPreview('Feed')): {
  port: FeedApplicationPort;
  metadataPort: FeedMetadataPort;
  cachePort: FeedItemsCachePort;
} {
  return {
    port: {
      getAllFeeds: vi.fn().mockResolvedValue([]),
      getFeedById: vi.fn().mockResolvedValue(undefined),
      getFeedItems: vi.fn().mockResolvedValue([]),
      deleteFeedItemById: vi.fn().mockResolvedValue(undefined),
      deleteFeedById: vi.fn().mockResolvedValue(undefined),
      createFeed: vi.fn().mockResolvedValue(undefined),
      createFeedFromUrl: vi.fn().mockResolvedValue(undefined),
    },
    metadataPort: {
      getOpenGraphPreview: vi.fn().mockResolvedValue(preview),
    },
    cachePort: {
      read: vi.fn().mockResolvedValue(undefined),
      write: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function createOpenGraphPreview(title: string): OpenGraphPreview {
  return {
    url: 'https://example.com',
    title,
    description: null,
    image: null,
    video: null,
    siteName: null,
    type: null,
    providerData: null,
  };
}
