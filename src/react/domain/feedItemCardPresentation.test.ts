// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { analyzeFeedItem } from './feedItemPreview';
import {
  buildFeedItemCardPresentation,
  shouldLoadRemotePreview,
} from './feedItemCardPresentation';
import type { FeedItem } from '../types';

function item(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 1,
    feedId: 2,
    link: 'https://example.com/story',
    title: 'Story',
    text: '',
    ...overrides,
  };
}

describe('feed item card presentation', () => {
  it('does not request a remote preview when local media is complete', () => {
    const feedItem = item({ text: '<p>Readable summary</p><img src="https://example.com/cover.jpg">' });
    expect(shouldLoadRemotePreview(feedItem, analyzeFeedItem(feedItem), false)).toBe(false);
  });

  it('requests a remote preview for VK media without readable local text', () => {
    const feedItem = item({
      link: 'https://vk.com/wall-1_2',
      text: '<img src="https://example.com/cover.jpg">',
    });
    expect(shouldLoadRemotePreview(feedItem, analyzeFeedItem(feedItem), false)).toBe(true);
  });

  it('keeps the local image as a fallback for a remote Rezka preview', () => {
    const feedItem = item({
      link: 'https://hdrezka.me/films/drama/123-story.html',
      text: '<img src="https://example.com/local.jpg">',
    });
    const presentation = buildFeedItemCardPresentation({
      item: feedItem,
      analysis: analyzeFeedItem(feedItem),
      nsfwMode: 'show',
      remotePreview: {
        liquipediaMatch: null,
        openGraphPreview: {
          url: feedItem.link,
          title: 'Story',
          description: null,
          image: 'https://example.com/original.jpg',
          video: null,
          siteName: 'HDrezka',
          type: 'video.movie',
          providerData: null,
        },
      },
      previewFailures: 0,
    });

    expect(presentation.preview?.src).toBe('https://example.com/original.jpg');
    expect(presentation.preview?.fallbackSrc).toBe('https://example.com/local.jpg');
  });
});
