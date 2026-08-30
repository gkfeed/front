import type { FeedItemProvider } from './feedItemPreviewTypes';
import type {
  FeedItemCardCopyDescriptor,
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardPreviewDescriptor,
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
    preview: resolvePreviewDescriptor(variant, isShortVideo, adapter.isTikTok),
    copy: resolveCopyDescriptor(provider, variant, imagePreview, isShortVideo),
    showInstagramIdentity: adapter.showInstagramIdentity,
    showHltvCountdown: adapter.supplementary === 'hltv',
    showTikTokComments: adapter.supplementary === 'tiktok',
  };
}

function resolvePreviewDescriptor(
  variant: FeedItemCardVariant,
  isShortVideo: boolean,
  isTikTok: boolean,
): FeedItemCardPreviewDescriptor {
  switch (variant.type) {
    case 'matreshka':
      return { type: 'matreshka', videoId: variant.videoId };
    case 'sasflix':
      return { type: 'sasflix', publicationId: variant.publicationId };
    case 'youtube':
      return { type: 'youtube', videoId: variant.videoId };
    case 'twitch':
      return { type: 'twitch', channel: variant.channel };
    case 'instagram':
    case 'liquipedia':
    case 'simple-image':
    case 'standard':
    case 'tiktok':
      return { type: 'media', isShortVideo, isTikTok };
    default:
      return assertNever(variant);
  }
}

function resolveCopyDescriptor(
  provider: FeedItemProvider,
  variant: FeedItemCardVariant,
  imagePreview: FeedItemCardImagePreview,
  isShortVideo: boolean,
): FeedItemCardCopyDescriptor {
  if (provider === 'vk') return 'standard';
  if (imagePreview.type !== 'none' || isShortVideo) return 'none';
  switch (variant.type) {
    case 'matreshka':
    case 'sasflix':
    case 'youtube':
    case 'twitch':
    case 'simple-image':
      return variant.type;
    case 'instagram':
    case 'liquipedia':
    case 'standard':
    case 'tiktok':
      return 'standard';
    default:
      return assertNever(variant);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item variant: ${JSON.stringify(value)}`);
}
