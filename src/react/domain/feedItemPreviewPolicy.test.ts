// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type { FeedItem } from '../types';
import { analyzeFeedItem } from './feedItemAnalysis';
import type { NsfwMode, RemotePreview } from './feedItemCardContracts';
import { resolveFeedItemPreviewPolicy } from './feedItemPreviewPolicy';
import { EMPTY_REMOTE_PREVIEW } from './remotePreview';

type PolicyCase = {
  name: string;
  item: FeedItem;
  nsfwMode?: NsfwMode;
  remotePreview?: RemotePreview;
  failures?: number;
  request: 'none' | 'open-graph' | 'liquipedia';
  preview: string | null;
  visible: string | null;
  fallback?: string;
};

const cases: PolicyCase[] = [
  {
    name: 'complete local media stays local',
    item: feedItem({
      text: '<p>Readable summary</p><img src="https://example.com/local.jpg">',
    }),
    request: 'none',
    preview: 'https://example.com/local.jpg',
    visible: 'https://example.com/local.jpg',
  },
  {
    name: 'missing generic media requests Open Graph',
    item: feedItem(),
    request: 'open-graph',
    preview: null,
    visible: null,
  },
  {
    name: 'VK prefers the remote original and falls back to its local thumbnail',
    item: feedItem({
      link: 'https://vk.com/wall-1_2',
      text: '<p>Post text</p><img src="https://example.com/cropped.jpg">',
    }),
    remotePreview: openGraphRemote({ image: 'https://example.com/original.jpg' }),
    failures: 1,
    request: 'open-graph',
    preview: 'https://example.com/original.jpg',
    visible: 'https://example.com/cropped.jpg',
    fallback: 'https://example.com/cropped.jpg',
  },
  {
    name: 'Reddit video replaces its feed thumbnail',
    item: feedItem({
      link: 'https://www.reddit.com/r/example/comments/abc123/post/',
      text: '<img src="https://share.redd.it/preview/post/abc123">',
    }),
    remotePreview: openGraphRemote({
      image: 'https://example.com/poster.jpg',
      video: 'https://example.com/video.mp4',
    }),
    request: 'open-graph',
    preview: 'https://example.com/video.mp4',
    visible: 'https://example.com/video.mp4',
  },
  {
    name: 'Rezka requests its original despite a local thumbnail',
    item: feedItem({
      link: 'https://hdrezka.me/films/drama/123-story.html',
      text: '<img src="https://example.com/local.jpg">',
    }),
    remotePreview: openGraphRemote({ image: 'https://example.com/original.jpg' }),
    request: 'open-graph',
    preview: 'https://example.com/original.jpg',
    visible: 'https://example.com/original.jpg',
    fallback: 'https://example.com/local.jpg',
  },
  {
    name: 'Instagram Reel requests video metadata despite a local fallback',
    item: feedItem({
      link: 'https://www.instagram.com/reel/Video123/',
      title: 'inst: creator',
      text: '<img src="https://example.com/instagram.jpg">',
    }),
    request: 'open-graph',
    preview: 'https://example.com/instagram.jpg',
    visible: 'https://example.com/instagram.jpg',
  },
  {
    name: 'Sasflix requests stream metadata despite a local cover',
    item: feedItem({
      link: 'https://sasflix.ru/topics/c3895a19-330e-4483-ac69-14fe9d0fd9c6',
      text: '<img src="https://example.com/sasflix.jpg">',
    }),
    request: 'open-graph',
    preview: 'https://example.com/sasflix.jpg',
    visible: 'https://example.com/sasflix.jpg',
  },
  {
    name: 'OneFootball requests match data despite a local image',
    item: feedItem({
      link: 'https://onefootball.com/en/match/2700208',
      text: '<img src="https://example.com/match.jpg">',
    }),
    request: 'open-graph',
    preview: 'https://example.com/match.jpg',
    visible: 'https://example.com/match.jpg',
  },
  {
    name: 'TikTok embed needs no remote request',
    item: feedItem({ link: 'https://www.tiktok.com/@creator/video/1234567890' }),
    request: 'none',
    preview: 'https://www.tiktok.com/player/v1/1234567890?autoplay=1&muted=0&loop=1&controls=1&music_info=0&description=0&rel=0',
    visible: 'https://www.tiktok.com/player/v1/1234567890?autoplay=1&muted=0&loop=1&controls=1&music_info=0&description=0&rel=0',
  },
  {
    name: 'Liquipedia match data replaces visible media',
    item: feedItem({ link: 'https://liquipedia.net/dota2/Match%3AID_example' }),
    remotePreview: {
      openGraphPreview: null,
      liquipediaMatch: {
        date: 'Tomorrow',
        status: 'upcoming',
        score: ['-', '-'],
        teams: [
          { name: 'Team A', shortName: 'A', logo: null, results: [] },
          { name: 'Team B', shortName: 'B', logo: null, results: [] },
        ],
        tournament: 'Example Cup',
      },
    },
    request: 'liquipedia',
    preview: null,
    visible: null,
  },
  {
    name: 'hidden NSFW media makes no remote request',
    item: feedItem({
      link: 'https://pornhub.com/view_video.php?viewkey=123',
      text: '<img src="https://example.com/nsfw.jpg">',
    }),
    nsfwMode: 'hide',
    request: 'none',
    preview: 'https://example.com/nsfw.jpg',
    visible: null,
  },
];

describe('feed item preview policy', () => {
  it.each(cases)('$name', ({
    item,
    nsfwMode = 'show',
    remotePreview = EMPTY_REMOTE_PREVIEW,
    failures = 0,
    request,
    preview,
    visible,
    fallback,
  }) => {
    const policy = resolveFeedItemPreviewPolicy({
      item,
      providerView: analyzeFeedItem(item),
      nsfwMode,
      remotePreview,
      previewFailures: failures,
    });

    expect(policy.remoteRequest?.source ?? 'none').toBe(request);
    expect(policy.preview?.src ?? null).toBe(preview);
    expect(policy.visiblePreview?.src ?? null).toBe(visible);
    expect(policy.preview?.fallbackSrc).toBe(fallback);
  });
});

function feedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 1,
    feedId: 2,
    link: 'https://example.com/story',
    title: 'Story',
    text: '',
    ...overrides,
  };
}

function openGraphRemote(
  overrides: Partial<OpenGraphPreview> = {},
): RemotePreview {
  return {
    liquipediaMatch: null,
    openGraphPreview: {
      url: 'https://example.com/story',
      title: 'Story',
      description: null,
      image: null,
      video: null,
      siteName: 'Example',
      type: 'article',
      providerData: null,
      ...overrides,
    },
  };
}
