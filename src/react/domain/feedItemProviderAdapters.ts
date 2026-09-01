import type { FeedItemProvider } from './feedItemPreviewTypes';
import type { FeedItemProviderAdapter } from './feedItemCardContracts';

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

const feedItemProviderRegistry = {
  generic: createFeedItemProviderAdapter({
    supportsSimpleImage: true,
    resolveVariant: ({ isSimpleImage }) => isSimpleImage ? { type: 'simple-image' } : { type: 'standard' },
    classNames: (variant) => variant.type === 'simple-image' ? ['reader-card--simple-image'] : [],
  }),
  hltv: createFeedItemProviderAdapter({ supplementary: 'hltv' }),
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
      ? ['reader-card--matreshka', 'reader-card--player', 'reader-card--landscape-media']
      : [],
  }),
  onefootball: createFeedItemProviderAdapter({
    supportsSimpleImage: true,
    resolveVariant: ({ isSimpleImage }) => isSimpleImage
      ? { type: 'simple-image' }
      : { type: 'standard' },
    classNames: () => ['reader-card--onefootball'],
  }),
  sasflix: createFeedItemProviderAdapter({
    resolveVariant: ({ sasflixPublicationId }) => sasflixPublicationId
      ? { type: 'sasflix', publicationId: sasflixPublicationId }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'sasflix'
      ? ['reader-card--sasflix', 'reader-card--player', 'reader-card--landscape-media']
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
      ? ['reader-card--twitch', 'reader-card--player', 'reader-card--landscape-media']
      : [],
  }),
  vk: createFeedItemProviderAdapter({ classNames: () => ['reader-card--vk'] }),
  youtube: createFeedItemProviderAdapter({
    resolveVariant: ({ youtubeVideoId }) => youtubeVideoId
      ? { type: 'youtube', videoId: youtubeVideoId }
      : { type: 'standard' },
    classNames: (variant) => variant.type === 'youtube'
      ? ['reader-card--youtube', 'reader-card--player', 'reader-card--landscape-media']
      : [],
  }),
} satisfies Readonly<Record<FeedItemProvider, FeedItemProviderAdapter>>;

export function getFeedItemProviderAdapter(provider: FeedItemProvider): FeedItemProviderAdapter {
  return feedItemProviderRegistry[provider];
}
