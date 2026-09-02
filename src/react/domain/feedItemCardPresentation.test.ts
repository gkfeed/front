// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { analyzeFeedItem } from './feedItemPreview';
import { buildFeedItemCardPresentation } from './feedItemCardPresentation';
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
  it('centralizes article reader eligibility in the presentation model', () => {
    const trashboxItem = item({ link: 'https://trashbox.ru/link/story' });
    const presentation = buildFeedItemCardPresentation({
      item: trashboxItem,
      providerView: analyzeFeedItem(trashboxItem),
      nsfwMode: 'show',
      remotePreview: { liquipediaMatch: null, openGraphPreview: null },
      previewFailures: 0,
    });

    expect(presentation.canReadArticle).toBe(true);

    const vkItem = item({ link: 'https://vk.com/wall-1_2' });
    const vkPresentation = buildFeedItemCardPresentation({
      item: vkItem,
      providerView: analyzeFeedItem(vkItem),
      nsfwMode: 'show',
      remotePreview: {
        liquipediaMatch: null,
        openGraphPreview: {
          url: vkItem.link,
          title: 'Story',
          description: null,
          image: null,
          video: null,
          siteName: 'VK',
          type: 'article',
          providerData: null,
        },
      },
      previewFailures: 0,
    });

    expect(vkPresentation.canReadArticle).toBe(false);
  });
});
