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

  it('requests a remote preview for Reddit media even when the feed has a thumbnail', () => {
    const feedItem = item({
      link: 'https://www.reddit.com/r/example/comments/abc123/post/',
      text: '<img src="https://share.redd.it/preview/post/abc123">',
    });
    expect(shouldLoadRemotePreview(feedItem, analyzeFeedItem(feedItem), false)).toBe(true);
  });

  it('requests a remote preview for an Instagram Reel with an embed fallback', () => {
    const feedItem = item({
      link: 'https://www.instagram.com/reel/Video123/',
      title: 'inst: creator',
    });
    expect(shouldLoadRemotePreview(feedItem, analyzeFeedItem(feedItem), false)).toBe(true);
  });

  it('requests Sasflix stream metadata even when the feed includes a thumbnail', () => {
    const feedItem = item({
      link: 'https://sasflix.ru/topics/c3895a19-330e-4483-ac69-14fe9d0fd9c6',
      text: '<img src="https://sasflix.ru/api/image/cover?w=1024">',
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

  it('centralizes article reader eligibility in the presentation model', () => {
    const trashboxItem = item({ link: 'https://trashbox.ru/link/story' });
    const presentation = buildFeedItemCardPresentation({
      item: trashboxItem,
      analysis: analyzeFeedItem(trashboxItem),
      nsfwMode: 'show',
      remotePreview: { liquipediaMatch: null, openGraphPreview: null },
      previewFailures: 0,
    });

    expect(presentation.canReadArticle).toBe(true);

    const vkItem = item({ link: 'https://vk.com/wall-1_2' });
    const vkPresentation = buildFeedItemCardPresentation({
      item: vkItem,
      analysis: analyzeFeedItem(vkItem),
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
