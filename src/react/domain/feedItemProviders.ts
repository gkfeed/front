import type { FeedItem } from '../types';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
  FeedItemProviderAdapter,
} from './feedItemCardContracts';
import {
  isHltvMatchUrl,
  isLiquipediaMatchUrl,
  isTikTokVideoUrl,
  isVkHost,
} from '../../../shared/urlRules';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  parseUrl,
} from './feedItemUrls';
import { getTwitchChannel } from './twitchPreview';
import { isInstagramMediaUrl } from './instagramPreview';

export type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardPreviewDescriptor,
  FeedItemCardCopyDescriptor,
  FeedItemCardVariant,
  FeedItemProviderAdapter,
} from './feedItemCardContracts';

type FeedItemProviderAdapterOverrides = Partial<FeedItemProviderAdapter>;

function createFeedItemProviderAdapter(
  overrides: FeedItemProviderAdapterOverrides,
): FeedItemProviderAdapter {
  return {
    supplementary: 'none',
    isShortVideo: false,
    isTikTok: false,
    showInstagramIdentity: false,
    supportsSimpleImage: false,
    resolveVariant: () => ({ type: 'standard' }),
    classNames: () => [],
    ...overrides,
  };
}

const feedItemProviderRegistry: Record<FeedItemProvider, FeedItemProviderAdapter> = {
  generic: createFeedItemProviderAdapter({
    supportsSimpleImage: true,
    resolveVariant: ({ isSimpleImage }) => isSimpleImage ? { type: 'simple-image' } : { type: 'standard' },
    classNames: (variant) => variant.type === 'simple-image' ? ['reader-card--simple-image'] : [],
  }),
  hltv: createFeedItemProviderAdapter({
    supplementary: 'hltv',
  }),
  instagram: createFeedItemProviderAdapter({
    isShortVideo: true,
    showInstagramIdentity: true,
    resolveVariant: ({ isInstagramPhoto }) => ({
      type: 'instagram',
      media: isInstagramPhoto ? 'photo' : 'video',
    }),
    classNames: (variant) => [
      'reader-card--short-video',
      'reader-card--instagram',
      ...(variant.type === 'instagram' && variant.media === 'photo'
        ? ['reader-card--instagram-photo', 'reader-card--portrait-image']
        : []),
    ],
  }),
  liquipedia: createFeedItemProviderAdapter({
    resolveVariant: () => ({ type: 'liquipedia' }),
    classNames: () => ['reader-card--liquipedia'],
  }),
  matreshka: createFeedItemProviderAdapter({
    resolveVariant: ({ matreshkaVideoId }) => matreshkaVideoId
      ? { type: 'matreshka', videoId: matreshkaVideoId }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'matreshka'
      ? ['reader-card--matreshka', 'reader-card--landscape-media']
      : [],
  }),
  sasflix: createFeedItemProviderAdapter({
    resolveVariant: ({ sasflixPublicationId }) => sasflixPublicationId
      ? { type: 'sasflix', publicationId: sasflixPublicationId }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'sasflix'
      ? ['reader-card--sasflix', 'reader-card--landscape-media']
      : [],
  }),
  tiktok: createFeedItemProviderAdapter({
    supplementary: 'tiktok',
    isShortVideo: true,
    isTikTok: true,
    resolveVariant: () => ({ type: 'tiktok' }),
    classNames: () => ['reader-card--short-video', 'reader-card--tiktok'],
  }),
  twitch: createFeedItemProviderAdapter({
    resolveVariant: ({ twitchChannel }) => twitchChannel
      ? { type: 'twitch', channel: twitchChannel }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'twitch'
      ? ['reader-card--twitch', 'reader-card--landscape-media']
      : [],
  }),
  vk: createFeedItemProviderAdapter({
    classNames: () => ['reader-card--vk'],
  }),
  youtube: createFeedItemProviderAdapter({
    resolveVariant: ({ youtubeVideoId }) => youtubeVideoId
      ? { type: 'youtube', videoId: youtubeVideoId }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'youtube'
      ? ['reader-card--youtube', 'reader-card--landscape-media']
      : [],
  }),
};

export function getFeedItemProviderAdapter(provider: FeedItemProvider): FeedItemProviderAdapter {
  return feedItemProviderRegistry[provider];
}

export function getFeedItemCardPresentationDescriptor({
  provider,
  variant,
  imagePreview,
}: {
  provider: FeedItemProvider;
  variant: FeedItemCardVariant;
  imagePreview: FeedItemCardImagePreview;
}): FeedItemCardPresentationDescriptor {
  const adapter = getFeedItemProviderAdapter(provider);
  const isShortVideo = adapter.isShortVideo;

  return {
    className: [
      ...adapter.classNames(variant),
      imagePreview.type !== 'none' ? 'reader-card--image-preview' : '',
      imagePreview.type === 'generated' && imagePreview.source === 'reddit'
        ? 'reader-card--reddit-preview'
        : '',
      imagePreview.type === 'hltv' ? 'reader-card--hltv-preview' : '',
    ].filter(Boolean).join(' '),
    preview: variant.type === 'matreshka'
      ? { type: 'matreshka', videoId: variant.videoId }
      : variant.type === 'sasflix'
        ? { type: 'sasflix', publicationId: variant.publicationId }
      : variant.type === 'youtube'
        ? { type: 'youtube', videoId: variant.videoId }
        : variant.type === 'twitch'
        ? { type: 'twitch', channel: variant.channel }
        : { type: 'media', isShortVideo, isTikTok: adapter.isTikTok },
    copy: imagePreview.type !== 'none' || isShortVideo
      ? 'none'
      : variant.type === 'matreshka'
      ? 'matreshka'
      : variant.type === 'sasflix'
        ? 'sasflix'
      : variant.type === 'youtube'
        ? 'youtube'
        : variant.type === 'twitch'
          ? 'twitch'
          : variant.type === 'simple-image'
            ? 'simple-image'
            : 'standard',
    showInstagramIdentity: adapter.showInstagramIdentity,
    showHltvCountdown: adapter.supplementary === 'hltv',
    showTikTokComments: adapter.supplementary === 'tiktok',
  };
}

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
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

export function getFeedItemProviderFromUrl(item: FeedItem, url: URL | null): FeedItemProvider {
  // A valid provider URL is more authoritative than a feed title marker. Some
  // imported TikTok items retain an `inst:` title prefix from their source.
  if (url) {
    if (getMatreshkaVideoId(url)) return 'matreshka';
    if (getSasflixPublicationId(url)) return 'sasflix';
    if (getYoutubeVideoId(url)) return 'youtube';
    if (getTwitchChannel(url)) return 'twitch';
    if (isTikTokVideoUrl(url)) return 'tiktok';
    if (isInstagramMediaUrl(url)) return 'instagram';
    if (isVkHost(url.hostname)) return 'vk';
    if (isHltvMatchUrl(url)) return 'hltv';
    if (isLiquipediaMatchUrl(url)) return 'liquipedia';
  }

  if (/^inst:\s*/i.test(item.title)) return 'instagram';
  return 'generic';
}
