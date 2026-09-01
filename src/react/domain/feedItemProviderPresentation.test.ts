import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import {
  feedItemProviderPresentations,
  getFeedItemProvider,
  getFeedItemProviderDisplayFacts,
  getFeedItemProviderLoadingRules,
  resolveFeedItemProviderVariant,
} from './feedItemProviderPresentation';

function item(link: string, title = 'Story'): FeedItem {
  return { id: 1, feedId: 2, link, title, text: '' };
}

const providerUrls: ReadonlyArray<[FeedItemProvider, string]> = [
  ['generic', 'https://example.com/story'],
  ['hltv', 'https://www.hltv.org/matches/2396006/team-a-vs-team-b'],
  ['instagram', 'https://www.instagram.com/reel/Video123/'],
  ['liquipedia', 'https://liquipedia.net/dota2/Match%3AID_example'],
  ['matreshka', 'https://matreshka.tv/video/episode_123'],
  ['onefootball', 'https://onefootball.com/en/match/2700208'],
  ['sasflix', 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea'],
  ['tiktok', 'https://www.tiktok.com/@creator/video/1234567890'],
  ['twitch', 'https://www.twitch.tv/creator'],
  ['vk', 'https://vk.com/wall-1_2'],
  ['youtube', 'https://youtu.be/abcdefghi'],
];

const emptyVariantContext = {
  youtubeVideoId: null,
  twitchChannel: null,
  matreshkaVideoId: null,
  sasflixPublicationId: null,
  isSimpleImage: false,
  isInstagramPhoto: false,
};

const providerDecisions: ReadonlyArray<[
  FeedItemProvider,
  Partial<Parameters<typeof resolveFeedItemProviderVariant>[1]>,
  string,
  Partial<ReturnType<typeof getFeedItemProviderLoadingRules>>,
  Partial<ReturnType<typeof getFeedItemProviderDisplayFacts>>,
]> = [
  ['generic', { isSimpleImage: true }, 'simple-image', {}, { supportsSimpleImage: true }],
  ['hltv', {}, 'standard', { livePreview: 'hltv', metadata: 'hltv' }, { supplementary: 'hltv' }],
  ['instagram', { isInstagramPhoto: true }, 'instagram', {}, {
    isShortVideo: true,
    showInstagramIdentity: true,
  }],
  ['liquipedia', {}, 'liquipedia', { remotePreview: 'liquipedia' }, {}],
  ['matreshka', { matreshkaVideoId: 'episode_123' }, 'matreshka', {}, {}],
  ['onefootball', { isSimpleImage: true }, 'simple-image', {}, { supportsSimpleImage: true }],
  ['sasflix', { sasflixPublicationId: 'publication-id' }, 'sasflix', {
    loadingPlaceholder: 'none',
  }, {}],
  ['tiktok', {}, 'tiktok', { remotePreview: 'none', previewMode: 'tiktok-embed' }, {
    supplementary: 'tiktok',
    isShortVideo: true,
    isTikTok: true,
  }],
  ['twitch', { twitchChannel: 'creator' }, 'twitch', { remotePreview: 'none' }, {}],
  ['vk', {}, 'standard', { description: 'vk' }, {}],
  ['youtube', { youtubeVideoId: 'abcdefghi' }, 'youtube', {}, {}],
];

describe('feed item provider presentation', () => {
  it('keeps one complete definition for every provider', () => {
    expect(Object.keys(feedItemProviderPresentations).sort()).toEqual(
      providerUrls.map(([provider]) => provider).sort(),
    );

    for (const provider of providerUrls.map(([candidate]) => candidate)) {
      expect(getFeedItemProviderLoadingRules(provider)).toBe(
        feedItemProviderPresentations[provider].loading,
      );
      expect(getFeedItemProviderDisplayFacts(provider)).toBe(
        feedItemProviderPresentations[provider].display,
      );
    }
  });

  it.each(providerUrls)('detects %s items', (provider, link) => {
    expect(getFeedItemProvider(item(link))).toBe(provider);
  });

  it('lets a provider URL override a stale Instagram title marker', () => {
    expect(getFeedItemProvider(item('https://youtu.be/abcdefghi', 'inst: old source')))
      .toBe('youtube');
    expect(getFeedItemProvider(item('not a url', 'inst: creator'))).toBe('instagram');
  });

  it.each(providerDecisions)(
    'owns the complete loading, variant, and display decisions for %s',
    (provider, context, variantType, loading, display) => {
      expect(getFeedItemProviderLoadingRules(provider)).toMatchObject(loading);
      expect(getFeedItemProviderDisplayFacts(provider)).toMatchObject(display);
      expect(resolveFeedItemProviderVariant(provider, {
        ...emptyVariantContext,
        ...context,
      }).type).toBe(variantType);
    },
  );

  it('resolves provider variants without CSS knowledge', () => {
    const variant = resolveFeedItemProviderVariant('youtube', {
      ...emptyVariantContext,
      youtubeVideoId: 'abcdefghi',
    });

    expect(variant).toEqual({ type: 'youtube', videoId: 'abcdefghi' });
    expect(JSON.stringify(feedItemProviderPresentations)).not.toContain('reader-card--');
  });
});
