import {
  isHltvMatchUrl,
  isLiquipediaMatchUrl,
  isOneFootballMatchUrl,
  isTikTokVideoUrl,
  isVkHost,
} from '../../../shared/urlRules';

import type { FeedItem } from '../types';
import type { RemotePreviewSource } from './feedItemCardContracts';
import { isInstagramMediaUrl } from './instagramPreview';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  parseUrl,
} from './feedItemUrls';
import { getTwitchChannel } from './twitchPreview';

export type FeedItemProviderLoadingRules = {
  remotePreview: RemotePreviewSource;
  livePreview: 'none' | 'hltv';
  loadingPlaceholder: 'when-missing' | 'none';
  previewMode: 'local-first' | 'tiktok-embed';
  description: 'none' | 'vk';
  metadata: 'none' | 'hltv';
};

type FeedItemProviderDefinition = {
  matches: (item: FeedItem, url: URL | null) => boolean;
  loading: FeedItemProviderLoadingRules;
};

const defaultLoadingRules: FeedItemProviderLoadingRules = {
  remotePreview: 'open-graph',
  livePreview: 'none',
  loadingPlaceholder: 'when-missing',
  previewMode: 'local-first',
  description: 'none',
  metadata: 'none',
};

function defineProvider(
  overrides: {
    matches?: FeedItemProviderDefinition['matches'];
    loading?: Partial<FeedItemProviderLoadingRules>;
  } = {},
): FeedItemProviderDefinition {
  return {
    matches: overrides.matches ?? (() => false),
    loading: { ...defaultLoadingRules, ...overrides.loading },
  };
}

/** Provider detection and the loading facts needed before a remote response exists. */
export const feedItemProviderResources = {
  generic: defineProvider(),
  hltv: defineProvider({
    matches: (_item, url) => Boolean(url && isHltvMatchUrl(url)),
    loading: { livePreview: 'hltv', metadata: 'hltv' },
  }),
  instagram: defineProvider({
    matches: (_item, url) => Boolean(url && isInstagramMediaUrl(url)),
  }),
  liquipedia: defineProvider({
    matches: (_item, url) => Boolean(url && isLiquipediaMatchUrl(url)),
    loading: { remotePreview: 'liquipedia' },
  }),
  matreshka: defineProvider({
    matches: (_item, url) => Boolean(url && getMatreshkaVideoId(url)),
  }),
  onefootball: defineProvider({
    matches: (_item, url) => Boolean(url && isOneFootballMatchUrl(url)),
  }),
  sasflix: defineProvider({
    matches: (_item, url) => Boolean(url && getSasflixPublicationId(url)),
    loading: { loadingPlaceholder: 'none' },
  }),
  tiktok: defineProvider({
    matches: (_item, url) => Boolean(url && isTikTokVideoUrl(url)),
    loading: { remotePreview: 'none', previewMode: 'tiktok-embed' },
  }),
  twitch: defineProvider({
    matches: (_item, url) => Boolean(url && getTwitchChannel(url)),
    loading: { remotePreview: 'none' },
  }),
  vk: defineProvider({
    matches: (_item, url) => Boolean(url && isVkHost(url.hostname)),
    loading: { description: 'vk' },
  }),
  youtube: defineProvider({
    matches: (_item, url) => Boolean(url && getYoutubeVideoId(url)),
  }),
} satisfies Readonly<Record<FeedItemProvider, FeedItemProviderDefinition>>;

const detectedProviders: readonly Exclude<FeedItemProvider, 'generic'>[] = [
  'matreshka',
  'sasflix',
  'youtube',
  'twitch',
  'tiktok',
  'instagram',
  'vk',
  'hltv',
  'onefootball',
  'liquipedia',
];

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
}

export function getFeedItemProviderFromUrl(item: FeedItem, url: URL | null): FeedItemProvider {
  for (const provider of detectedProviders) {
    if (feedItemProviderResources[provider].matches(item, url)) return provider;
  }

  // A valid provider URL wins over stale imported title markers.
  return /^inst:\s*/i.test(item.title) ? 'instagram' : 'generic';
}

export function getFeedItemProviderLoadingRules(
  provider: FeedItemProvider,
): FeedItemProviderLoadingRules {
  return feedItemProviderResources[provider].loading;
}

export function isYoutubeFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'youtube';
}

export function isTikTokFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'tiktok';
}

export function isInstagramFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'instagram';
}

export function isShortVideoFeedItem(item: FeedItem): boolean {
  const provider = getFeedItemProvider(item);
  return provider === 'instagram' || provider === 'tiktok';
}

export function isVkFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'vk';
}

export function isHltvFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'hltv';
}

export function isLiquipediaFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'liquipedia';
}
