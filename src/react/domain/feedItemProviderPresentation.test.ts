import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import {
  feedItemProviderResources,
  getFeedItemProvider,
  getFeedItemProviderLoadingRules,
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

const providerLoadingDecisions: ReadonlyArray<[
  FeedItemProvider,
  Partial<ReturnType<typeof getFeedItemProviderLoadingRules>>,
]> = [
  ['generic', {}],
  ['hltv', { livePreview: 'hltv', metadata: 'hltv' }],
  ['instagram', {}],
  ['liquipedia', { remotePreview: 'liquipedia' }],
  ['matreshka', {}],
  ['onefootball', {}],
  ['sasflix', { loadingPlaceholder: 'none' }],
  ['tiktok', { remotePreview: 'none', previewMode: 'tiktok-embed' }],
  ['twitch', { remotePreview: 'none' }],
  ['vk', { description: 'vk' }],
  ['youtube', {}],
];

describe('feed item provider presentation', () => {
  it('keeps one resource definition for every provider', () => {
    expect(Object.keys(feedItemProviderResources).sort()).toEqual(
      providerUrls.map(([provider]) => provider).sort(),
    );

    for (const provider of providerUrls.map(([candidate]) => candidate)) {
      expect(getFeedItemProviderLoadingRules(provider)).toBe(
        feedItemProviderResources[provider].loading,
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

  it.each(providerLoadingDecisions)(
    'owns the resource loading decisions for %s',
    (provider, loading) => {
      expect(getFeedItemProviderLoadingRules(provider)).toMatchObject(loading);
    },
  );
});
