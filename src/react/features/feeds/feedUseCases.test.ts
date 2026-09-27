import { describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { Feed, FeedItem } from '../../types';
import type {
  FeedCommandPort,
  FeedItemsPort,
  FeedItemsCachePort,
  FeedMetadataPort,
  FeedQueryPort,
} from '../featurePorts';
import { createFeedUseCases } from './feedUseCases';
import { ApiError } from '../../services/apiClient';

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
  it('shows cached items and applies changes without downloading the full list', async () => {
    const ports = createPorts();
    const { itemsPort, cachePort } = ports;
    vi.mocked(cachePort.read).mockResolvedValue({ items: [cachedItem], cursor: 'saved' });
    vi.mocked(itemsPort.getFeedItemChanges).mockResolvedValue({
      upserted: [currentItem], deletedIds: [cachedItem.id], nextCursor: 'next', hasMore: false,
    });
    const onCached = vi.fn();
    const useCases = createFeedUseCases(ports);

    await expect(useCases.loadFeedItems(credentials, { onCached })).resolves.toEqual([currentItem]);
    expect(onCached).toHaveBeenCalledWith([cachedItem]);
    expect(itemsPort.syncFeedItems).not.toHaveBeenCalled();
    expect(itemsPort.getFeedItemChanges).toHaveBeenCalledWith(credentials, 'saved', undefined);
    expect(cachePort.write).toHaveBeenCalledWith('reader', { items: [currentItem], cursor: 'next' });
  });

  it('upgrades a legacy cache record through a full sync', async () => {
    const ports = createPorts();
    vi.mocked(ports.cachePort.read).mockResolvedValue({ items: [cachedItem] });
    vi.mocked(ports.itemsPort.syncFeedItems).mockResolvedValue({ items: [currentItem], cursor: 'sync' });
    const onCached = vi.fn();
    const onProgress = vi.fn();
    const useCases = createFeedUseCases(ports);

    await expect(useCases.loadFeedItems(credentials, { onCached, onProgress }))
      .resolves.toEqual([currentItem]);
    expect(onCached).toHaveBeenCalledWith([cachedItem]);
    expect(ports.itemsPort.syncFeedItems).toHaveBeenCalledWith(credentials, undefined, onProgress, 10);
    expect(ports.itemsPort.getFeedItemChanges).toHaveBeenCalledWith(credentials, 'sync', undefined);
  });

  it('replays changes after the initial pages using their first sync cursor', async () => {
    const ports = createPorts();
    vi.mocked(ports.itemsPort.syncFeedItems).mockResolvedValue({ items: [cachedItem], cursor: 'first-page' });
    vi.mocked(ports.itemsPort.getFeedItemChanges).mockResolvedValue({
      upserted: [currentItem], deletedIds: [cachedItem.id], nextCursor: 'latest', hasMore: false,
    });

    await expect(createFeedUseCases(ports).loadFeedItems(credentials)).resolves.toEqual([currentItem]);
    expect(ports.itemsPort.getFeedItemChanges).toHaveBeenCalledWith(credentials, 'first-page', undefined);
    expect(ports.cachePort.write).toHaveBeenNthCalledWith(1, 'reader', {
      items: [cachedItem], cursor: 'first-page',
    });
    expect(ports.cachePort.write).toHaveBeenNthCalledWith(2, 'reader', {
      items: [currentItem], cursor: 'latest',
    });
  });

  it('recovers from an invalid saved cursor with a full sync', async () => {
    const ports = createPorts();
    vi.mocked(ports.cachePort.read).mockResolvedValue({ items: [cachedItem], cursor: 'expired' });
    vi.mocked(ports.itemsPort.getFeedItemChanges)
      .mockRejectedValueOnce(new ApiError('Invalid cursor', 400))
      .mockResolvedValue({ upserted: [], deletedIds: [], nextCursor: 'next', hasMore: false });
    vi.mocked(ports.itemsPort.syncFeedItems).mockResolvedValue({ items: [currentItem], cursor: 'fresh' });

    await expect(createFeedUseCases(ports).loadFeedItems(credentials)).resolves.toEqual([currentItem]);
    expect(ports.itemsPort.syncFeedItems).toHaveBeenCalledOnce();
    expect(ports.cachePort.write).toHaveBeenCalledWith('reader', {
      items: [currentItem], cursor: 'next',
    });
  });

  it('restarts a full sync if its cursor expires before changes are read', async () => {
    const ports = createPorts();
    vi.mocked(ports.itemsPort.syncFeedItems)
      .mockResolvedValueOnce({ items: [cachedItem], cursor: 'expired' })
      .mockResolvedValueOnce({ items: [currentItem], cursor: 'fresh' });
    vi.mocked(ports.itemsPort.getFeedItemChanges)
      .mockRejectedValueOnce(new ApiError('Invalid cursor', 400))
      .mockResolvedValueOnce({ upserted: [], deletedIds: [], nextCursor: 'latest', hasMore: false });

    await expect(createFeedUseCases(ports).loadFeedItems(credentials)).resolves.toEqual([currentItem]);
    expect(ports.itemsPort.syncFeedItems).toHaveBeenCalledTimes(2);
  });

  it('persists each change page before requesting the next one', async () => {
    const ports = createPorts();
    vi.mocked(ports.cachePort.read).mockResolvedValue({ items: [cachedItem], cursor: 'saved' });
    let finishWrite!: () => void;
    vi.mocked(ports.cachePort.write).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishWrite = resolve;
    }));
    vi.mocked(ports.itemsPort.getFeedItemChanges)
      .mockResolvedValueOnce({ upserted: [currentItem], deletedIds: [], nextCursor: 'page2', hasMore: true })
      .mockResolvedValueOnce({ upserted: [], deletedIds: [cachedItem.id], nextCursor: 'final', hasMore: false });
    const load = createFeedUseCases(ports).loadFeedItems(credentials);
    await vi.waitFor(() => expect(ports.cachePort.write).toHaveBeenCalledOnce());
    expect(ports.itemsPort.getFeedItemChanges).toHaveBeenCalledOnce();
    finishWrite();
    await expect(load).resolves.toEqual([currentItem]);
    expect(ports.itemsPort.getFeedItemChanges).toHaveBeenCalledTimes(2);
    expect(ports.cachePort.write).toHaveBeenLastCalledWith('reader', {
      items: [currentItem], cursor: 'final',
    });
  });

  it('removes a locally deleted item without discarding the change cursor', async () => {
    const ports = createPorts();
    vi.mocked(ports.cachePort.read).mockResolvedValue({
      items: [currentItem, cachedItem], cursor: 'saved',
    });
    const useCases = createFeedUseCases(ports);
    await useCases.loadFeedItems(credentials);

    useCases.removeFeedItemFromCache(credentials, currentItem.id);
    await vi.waitFor(() => expect(ports.cachePort.write).toHaveBeenLastCalledWith('reader', {
      items: [cachedItem], cursor: 'next',
    }));
    await expect(useCases.loadFeedItems(credentials)).resolves.toEqual([cachedItem]);
    expect(ports.itemsPort.syncFeedItems).not.toHaveBeenCalled();
    expect(ports.cachePort.delete).not.toHaveBeenCalled();
  });

  it('does not restore an in-flight snapshot after cache invalidation', async () => {
    const ports = createPorts();
    let finishLoad!: (snapshot: { items: FeedItem[]; cursor: string }) => void;
    vi.mocked(ports.itemsPort.syncFeedItems).mockImplementation(() => new Promise((resolve) => {
      finishLoad = resolve;
    }));
    const useCases = createFeedUseCases(ports);
    const load = useCases.loadFeedItems(credentials);
    await vi.waitFor(() => expect(ports.itemsPort.syncFeedItems).toHaveBeenCalledOnce());
    useCases.invalidateFeedItemsCache(credentials);
    finishLoad({ items: [currentItem], cursor: 'sync' });
    await load;
    expect(ports.cachePort.delete).toHaveBeenCalledWith('reader');
    expect(ports.cachePort.write).not.toHaveBeenCalled();
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

  it('creates posts and stories feeds from one Instagram profile', async () => {
    const ports = createPorts();
    const { commandPort } = ports;
    const useCases = createFeedUseCases(ports);

    await useCases.saveFeed({
      title: '  katya.marfaknchov  ',
      type: '  inst  ',
      url: '  https://www.instagram.com/katya.marfaknchov?stkn=share  ',
    }, 'extended', credentials);

    const profileUrl = 'https://www.instagram.com/katya.marfaknchov';
    expect(commandPort.createFeed).toHaveBeenCalledTimes(2);
    expect(commandPort.createFeed).toHaveBeenNthCalledWith(1, {
      title: 'katya.marfaknchov',
      type: 'inst',
      url: profileUrl,
    }, credentials);
    expect(commandPort.createFeed).toHaveBeenNthCalledWith(2, {
      title: 'katya.marfaknchov',
      type: 'stories',
      url: profileUrl,
    }, credentials);
  });

  it('resumes Instagram profile creation after the stories request fails', async () => {
    const ports = createPorts();
    const created: Feed[] = [];
    vi.mocked(ports.queryPort.getAllFeeds).mockImplementation(async () => [...created]);
    let failStories = true;
    vi.mocked(ports.commandPort.createFeed).mockImplementation(async (feed) => {
      if (feed.type === 'stories' && failStories) {
        failStories = false;
        throw new Error('Connection lost');
      }
      created.push({ ...feed, id: created.length + 1, url: `${feed.url}/` });
    });
    const useCases = createFeedUseCases(ports);
    const input = { title: 'Example', type: 'inst', url: 'https://www.instagram.com/example/' };

    await expect(useCases.saveFeed(input, 'extended', credentials)).rejects.toThrow('Connection lost');
    await expect(useCases.saveFeed(input, 'extended', credentials)).resolves.toBeUndefined();

    expect(created.map(({ type }) => type)).toEqual(['inst', 'stories']);
    expect(vi.mocked(ports.commandPort.createFeed).mock.calls.map(([feed]) => feed.type))
      .toEqual(['inst', 'stories', 'stories']);
  });

  it('falls back to a readable URL segment when title metadata is unavailable', async () => {
    const ports = createPorts();
    vi.mocked(ports.metadataPort.getOpenGraphPreview).mockRejectedValue(new Error('blocked'));
    const useCases = createFeedUseCases(ports);

    await expect(useCases.suggestFeedTitle(
      'https://de.pornhub.com/model/aquari',
    )).resolves.toBe('Aquari');
  });

  it('uses the Instagram username instead of its generic page metadata', async () => {
    const ports = createPorts(createOpenGraphPreview('Instagram'));
    const useCases = createFeedUseCases(ports);

    await expect(useCases.suggestFeedTitle(
      'https://www.instagram.com/katya.marfaknchov?stkn=ZmJ1bHY0bWZ6eXh2',
    )).resolves.toBe('katya.marfaknchov');
    expect(ports.metadataPort.getOpenGraphPreview).not.toHaveBeenCalled();
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
      syncFeedItems: vi.fn().mockResolvedValue({ items: [], cursor: 'sync' }),
      getFeedItemChanges: vi.fn().mockResolvedValue({
        upserted: [], deletedIds: [], nextCursor: 'next', hasMore: false,
      }),
    },
    commandPort: {
      deleteFeedItemById: vi.fn().mockResolvedValue(undefined),
      deleteFeedById: vi.fn().mockResolvedValue(undefined),
      createFeed: vi.fn().mockResolvedValue(undefined),
      createFeedFromUrl: vi.fn().mockResolvedValue(undefined),
    },
    metadataPort: {
      getOpenGraphPreview: vi.fn().mockResolvedValue(preview),
      getFeedTypeSuggestion: vi.fn().mockResolvedValue({ type: 'web', confidence: 1 }),
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
