import { getFeedItemProviderAdapter } from './feedItemProviderAdapters';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import type {
  FeedItemCardCopyDescriptor,
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardPreviewDescriptor,
  FeedItemCardVariant,
} from './feedItemCardContracts';

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
