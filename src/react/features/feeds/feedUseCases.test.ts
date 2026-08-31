import { describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { FeedItem } from '../../types';
import type {
  FeedCommandPort,
  FeedItemsPort,
  FeedItemsCachePort,
  FeedMetadataPort,
  FeedQueryPort,
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
    const ports = createPorts();
    const { itemsPort, cachePort } = ports;
    vi.mocked(cachePort.read).mockResolvedValue([cachedItem]);
    vi.mocked(itemsPort.getFeedItems).mockResolvedValue([currentItem]);
    const onCached = vi.fn();
    const onProgress = vi.fn();
    const useCases = createFeedUseCases(ports);

    await expect(useCases.loadFeedItems(credentials, { onCached, onProgress }))
      .resolves.toEqual([currentItem]);

    expect(cachePort.read).toHaveBeenCalledWith('reader', 15_000);
    expect(onCached).toHaveBeenCalledWith([cachedItem]);
    expect(itemsPort.getFeedItems).toHaveBeenCalledWith(
      credentials,
      undefined,
      undefined,
      onProgress,
      10,
    );
    expect(cachePort.write).toHaveBeenCalledWith('reader', [currentItem]);
  });

  it('prevents an invalidated in-flight load from restoring stale cache data', async () => {
    const ports = createPorts();
    const { itemsPort, cachePort } = ports;
    let finishLoad!: (items: FeedItem[]) => void;
    vi.mocked(itemsPort.getFeedItems).mockImplementation(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const useCases = createFeedUseCases(ports);

    const load = useCases.loadFeedItems(credentials);
    await vi.waitFor(() => expect(itemsPort.getFeedItems).toHaveBeenCalledOnce());
    useCases.invalidateFeedItemsCache(credentials);
    finishLoad([currentItem]);
    await load;

    expect(cachePort.delete).toHaveBeenCalledWith('reader');
    expect(cachePort.write).not.toHaveBeenCalled();
  });

  it('does not publish a cache read that was invalidated before it completed', async () => {
    const ports = createPorts();
    const { itemsPort, cachePort } = ports;
    let finishCacheRead!: (items: FeedItem[]) => void;
    vi.mocked(cachePort.read).mockImplementation(() => new Promise((resolve) => {
      finishCacheRead = resolve;
    }));
    vi.mocked(itemsPort.getFeedItems).mockResolvedValue([currentItem]);
    const onCached = vi.fn();
    const useCases = createFeedUseCases(ports);

    const load = useCases.loadFeedItems(credentials, { onCached });
    await vi.waitFor(() => expect(cachePort.read).toHaveBeenCalledOnce());
    useCases.invalidateFeedItemsCache(credentials);
    finishCacheRead([cachedItem]);
    await load;

    expect(onCached).not.toHaveBeenCalled();
    expect(cachePort.write).not.toHaveBeenCalled();
  });

  it('normalizes URL-only feed creation', async () => {
    const ports = createPorts();
    const { commandPort, metadataPort } = ports;
    const useCases = createFeedUseCases(ports);

    await useCases.saveFeed({
      title: '',
      type: 'web',
      url: '  https://example.com/feed.xml  ',
    }, 'lazy', credentials);

    expect(commandPort.createFeedFromUrl).toHaveBeenCalledWith(
      { url: 'https://example.com/feed.xml' },
      credentials,
    );
    expect(commandPort.createFeed).not.toHaveBeenCalled();
    expect(metadataPort.getOpenGraphPreview).not.toHaveBeenCalled();
  });

  it('resolves canonical YouTube channel metadata before creation', async () => {
    const preview = createOpenGraphPreview('  Fresh Technologies  ');
    const ports = createPorts(preview);
    const { commandPort, metadataPort } = ports;
    const useCases = createFeedUseCases(ports);

    await useCases.saveFeed({
      title: '',
      type: 'web',
      url: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ?si=shared',
    }, 'lazy', credentials);

    const canonicalUrl = 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ';
    expect(metadataPort.getOpenGraphPreview).toHaveBeenCalledWith(canonicalUrl);
    expect(commandPort.createFeed).toHaveBeenCalledWith({
      title: 'Fresh Technologies',
      type: 'yt',
      url: canonicalUrl,
    }, credentials);
    expect(commandPort.createFeedFromUrl).not.toHaveBeenCalled();
  });

  it('trims manual feed input without loading metadata', async () => {
    const ports = createPorts();
    const { commandPort, metadataPort } = ports;
    const useCases = createFeedUseCases(ports);

    await useCases.saveFeed({
      title: '  News  ',
      type: '  web  ',
      url: '  https://example.com/feed.xml  ',
    }, 'extended', null);

    expect(commandPort.createFeed).toHaveBeenCalledWith({
      title: 'News',
      type: 'web',
      url: 'https://example.com/feed.xml',
    }, null);
    expect(metadataPort.getOpenGraphPreview).not.toHaveBeenCalled();
  });
});

function createPorts(preview = createOpenGraphPreview('Feed')): {
  queryPort: FeedQueryPort;
  itemsPort: FeedItemsPort;
  commandPort: FeedCommandPort;
  metadataPort: FeedMetadataPort;
  cachePort: FeedItemsCachePort;
} {
  return {
    queryPort: {
      getAllFeeds: vi.fn().mockResolvedValue([]),
      getFeedById: vi.fn().mockResolvedValue(undefined),
    },
    itemsPort: {
      getFeedItems: vi.fn().mockResolvedValue([]),
    },
    commandPort: {
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
