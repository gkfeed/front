import { describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { FeedApplicationPort, FeedMetadataPort } from '../featurePorts';
import { createFeedUseCases } from './feedUseCases';

const credentials = { username: 'reader', password: 'secret' };

describe('feed use cases', () => {
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
