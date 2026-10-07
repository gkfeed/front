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
  it('retains extensionless Reddit video previews while the plugin is enabled', () => {
    const video = item({ link: 'https://v.redd.it/abc123' });
    expect(analyzeFeedItem(video).localPreview).toMatchObject({ src: video.link, type: 'video' });
    const disabled = analyzeFeedItem(video, new Set(['reddit']));
    expect(disabled.provider).toBe('generic');
    expect(disabled.localPreview).toBeNull();
  });

  it('does not use a disabled provider snapshot from a cached Open Graph response', () => {
    const match = item({ link: 'https://www.hltv.org/matches/123/example' });
    const result = buildFeedItemCardPresentation({
      item: match, providerView: analyzeFeedItem(match, new Set(['hltv'])), nsfwMode: 'show', previewFailures: 0,
      remotePreview: {
        liquipediaMatch: null,
        openGraphPreview: {
          url: match.link, title: 'Match', description: null, image: 'https://example.com/cover.jpg',
          video: null, siteName: 'HLTV', type: null,
          providerData: { provider: 'hltv', snapshot: { startsAt: null, teams: null, status: 'live', score: ['1', '0'], currentMap: null, completedMaps: null, playerStats: null, teamSides: null } },
        },
      },
    });
    expect(result.provider).toBe('generic');
    expect(result.hltvSnapshot).toBeNull();
    expect(result.openGraphPreview?.providerData).toBeNull();
    expect(result.visiblePreview?.src).toBe('https://example.com/cover.jpg');
  });

  it('does not resurrect a disabled VK embed or media proxy through feed/OG data', () => {
    const post = item({ link: 'https://vk.com/wall-1_2', text: '<iframe src="https://vk.com/video_ext.php?oid=-1&id=2"></iframe>' });
    const providerView = analyzeFeedItem(post, new Set(['vk']));
    expect(providerView.localPreview).toBeNull();
    const result = buildFeedItemCardPresentation({
      item: post, providerView, nsfwMode: 'show', previewFailures: 0,
      remotePreview: { liquipediaMatch: null, openGraphPreview: {
        url: post.link, title: null, description: null, image: null, video: 'https://vk.com/video-1_2', siteName: null, type: 'video', providerData: null,
      } },
    });
    expect(result.visiblePreview).toBeNull();
  });
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
