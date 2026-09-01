import {
  isHltvMatchUrl,
  isLiquipediaMatchUrl,
  isOneFootballMatchUrl,
  isTikTokVideoUrl,
  isVkHost,
} from '../../../shared/urlRules';

import type { FeedItem } from '../types';
import type {
  FeedItemCardVariant,
  FeedItemCardVariantContext,
  RemotePreviewSource,
} from './feedItemCardContracts';
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

export type FeedItemProviderDisplayFacts = {
  supplementary: 'none' | 'hltv' | 'tiktok';
  isShortVideo: boolean;
  isTikTok: boolean;
  showInstagramIdentity: boolean;
  supportsSimpleImage: boolean;
};

type FeedItemProviderDefinition = {
  matches: (item: FeedItem, url: URL | null) => boolean;
  loading: FeedItemProviderLoadingRules;
  display: FeedItemProviderDisplayFacts;
  resolveVariant: (context: FeedItemCardVariantContext) => FeedItemCardVariant;
};

const defaultLoadingRules: FeedItemProviderLoadingRules = {
  remotePreview: 'open-graph',
  livePreview: 'none',
  loadingPlaceholder: 'when-missing',
  previewMode: 'local-first',
  description: 'none',
  metadata: 'none',
};

const defaultDisplayFacts: FeedItemProviderDisplayFacts = {
  supplementary: 'none',
  isShortVideo: false,
  isTikTok: false,
  showInstagramIdentity: false,
  supportsSimpleImage: false,
};

function defineProvider(
  overrides: {
    matches?: FeedItemProviderDefinition['matches'];
    loading?: Partial<FeedItemProviderLoadingRules>;
    display?: Partial<FeedItemProviderDisplayFacts>;
    resolveVariant?: FeedItemProviderDefinition['resolveVariant'];
  } = {},
): FeedItemProviderDefinition {
  return {
    matches: overrides.matches ?? (() => false),
    loading: { ...defaultLoadingRules, ...overrides.loading },
    display: { ...defaultDisplayFacts, ...overrides.display },
    resolveVariant: overrides.resolveVariant ?? (() => ({ type: 'standard' })),
  };
}

/**
 * Complete framework-agnostic presentation knowledge for every provider.
 * React renderers intentionally remain outside this registry at the UI edge.
 */
export const feedItemProviderPresentations = {
  generic: defineProvider({
    display: { supportsSimpleImage: true },
    resolveVariant: ({ isSimpleImage }) => isSimpleImage
      ? { type: 'simple-image' }
      : { type: 'standard' },
  }),
  hltv: defineProvider({
    matches: (_item, url) => Boolean(url && isHltvMatchUrl(url)),
    loading: { livePreview: 'hltv', metadata: 'hltv' },
    display: { supplementary: 'hltv' },
  }),
  instagram: defineProvider({
    matches: (_item, url) => Boolean(url && isInstagramMediaUrl(url)),
    display: { isShortVideo: true, showInstagramIdentity: true },
    resolveVariant: ({ isInstagramPhoto }) => ({
      type: 'instagram',
      media: isInstagramPhoto ? 'photo' : 'video',
    }),
  }),
  liquipedia: defineProvider({
    matches: (_item, url) => Boolean(url && isLiquipediaMatchUrl(url)),
    loading: { remotePreview: 'liquipedia' },
    resolveVariant: () => ({ type: 'liquipedia' }),
  }),
  matreshka: defineProvider({
    matches: (_item, url) => Boolean(url && getMatreshkaVideoId(url)),
    resolveVariant: ({ matreshkaVideoId }) => matreshkaVideoId
      ? { type: 'matreshka', videoId: matreshkaVideoId }
      : { type: 'standard' },
  }),
  onefootball: defineProvider({
    matches: (_item, url) => Boolean(url && isOneFootballMatchUrl(url)),
    display: { supportsSimpleImage: true },
    resolveVariant: ({ isSimpleImage }) => isSimpleImage
      ? { type: 'simple-image' }
      : { type: 'standard' },
  }),
  sasflix: defineProvider({
    matches: (_item, url) => Boolean(url && getSasflixPublicationId(url)),
    loading: { loadingPlaceholder: 'none' },
    resolveVariant: ({ sasflixPublicationId }) => sasflixPublicationId
      ? { type: 'sasflix', publicationId: sasflixPublicationId }
      : { type: 'standard' },
  }),
  tiktok: defineProvider({
    matches: (_item, url) => Boolean(url && isTikTokVideoUrl(url)),
    loading: { remotePreview: 'none', previewMode: 'tiktok-embed' },
    display: { supplementary: 'tiktok', isShortVideo: true, isTikTok: true },
    resolveVariant: () => ({ type: 'tiktok' }),
  }),
  twitch: defineProvider({
    matches: (_item, url) => Boolean(url && getTwitchChannel(url)),
    loading: { remotePreview: 'none' },
    resolveVariant: ({ twitchChannel }) => twitchChannel
      ? { type: 'twitch', channel: twitchChannel }
      : { type: 'standard' },
  }),
  vk: defineProvider({
    matches: (_item, url) => Boolean(url && isVkHost(url.hostname)),
    loading: { description: 'vk' },
  }),
  youtube: defineProvider({
    matches: (_item, url) => Boolean(url && getYoutubeVideoId(url)),
    resolveVariant: ({ youtubeVideoId }) => youtubeVideoId
      ? { type: 'youtube', videoId: youtubeVideoId }
      : { type: 'standard' },
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
    if (feedItemProviderPresentations[provider].matches(item, url)) return provider;
  }

  // A valid provider URL wins over stale imported title markers.
  return /^inst:\s*/i.test(item.title) ? 'instagram' : 'generic';
}

export function getFeedItemProviderLoadingRules(
  provider: FeedItemProvider,
): FeedItemProviderLoadingRules {
  return feedItemProviderPresentations[provider].loading;
}

export function getFeedItemProviderDisplayFacts(
  provider: FeedItemProvider,
): FeedItemProviderDisplayFacts {
  return feedItemProviderPresentations[provider].display;
}

export function resolveFeedItemProviderVariant(
  provider: FeedItemProvider,
  context: FeedItemCardVariantContext,
): FeedItemCardVariant {
  return feedItemProviderPresentations[provider].resolveVariant(context);
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
  return getFeedItemProviderDisplayFacts(getFeedItemProvider(item)).isShortVideo;
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
