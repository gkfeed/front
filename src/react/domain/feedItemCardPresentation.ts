import { isInstagramMediaUrl } from './instagramPreview';
import { isNsfwLink } from './nsfw';
import { getFeedItemDescription } from './feedItemDescription';
import {
  getFeedItemProviderDisplayFacts,
  getFeedItemProviderLoadingRules,
  resolveFeedItemProviderVariant,
} from './feedItemProviderPresentation';
import { getRemoteFeedItemPreview } from './feedItemRemotePreview';
import { isRedditUrl, isRezkaUrl } from './feedItemUrls';
import { getTikTokEmbedPreview } from './tiktokPreview';
import type {
  FeedItemAnalysis,
  FeedItemPreview,
  FeedItemProvider,
} from './feedItemPreviewTypes';
import type {
  FeedItemCardImagePreview,
  FeedItemCardMetadata,
  FeedItemCardPresentation,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
  NsfwMode,
  RemotePreview,
} from './feedItemCardContracts';
import type { FeedItem } from '../types';
import { getHltvSnapshot } from '../../../shared/providerData/hltv';
import { getOneFootballSnapshot } from '../../../shared/providerData/oneFootball';

export type { FeedItemCardPresentation } from './feedItemCardContracts';

export type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
} from './feedItemCardContracts';

export function shouldLoadRemotePreview(
  item: FeedItem,
  analysis: FeedItemAnalysis,
  shouldHideNsfw: boolean,
): boolean {
  const { localPreview, url } = analysis;
  const loading = getFeedItemProviderLoadingRules(analysis.provider);
  const usesVkDescription = loading.description === 'vk';
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && loading.remotePreview !== 'none'
    && (isRedditUrl(url)
      || analysis.provider === 'vk'
      || isRezkaUrl(url)
      || (analysis.provider === 'instagram' && Boolean(url && isInstagramMediaUrl(url)))
      || analysis.provider === 'sasflix'
      || analysis.provider === 'onefootball'
      || !(localPreview?.src && (!usesVkDescription || feedDescription)));
}

export function buildFeedItemCardPresentation({
  item,
  analysis,
  nsfwMode,
  remotePreview,
  previewFailures,
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  previewFailures: number;
}): FeedItemCardPresentation {
  const previews = resolvePreviews({ item, analysis, remotePreview });
  const visiblePreview = resolveVisiblePreview({
    preview: previews.preview,
    tiktokEmbedPreview: previews.tiktokEmbedPreview,
    previewFailures,
    hasLiquipediaMatch: Boolean(remotePreview.liquipediaMatch),
  });
  const metadata = resolveMetadata({
    item,
    analysis,
    nsfwMode,
    remotePreview,
    visiblePreview,
    remoteItemPreview: previews.remoteItemPreview,
  });
  const descriptor = resolveDescriptor({
    provider: metadata.provider,
    variant: metadata.variant,
    imagePreview: metadata.imagePreview,
  });

  return {
    item,
    ...metadata,
    canReadArticle: canReadFeedItemArticle(metadata),
    descriptor,
    preview: previews.preview,
    visiblePreview,
  };
}

function resolvePreviews({
  item,
  analysis,
  remotePreview,
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  remotePreview: RemotePreview;
}): {
  preview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
} {
  const { localPreview } = analysis;
  const loading = getFeedItemProviderLoadingRules(analysis.provider);
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(analysis.url);
  const isReddit = isRedditUrl(analysis.url);
  const isVk = analysis.provider === 'vk';
  const usesTikTokEmbed = loading.previewMode === 'tiktok-embed';
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const instagramVideoPreview = analysis.provider === 'instagram'
    && remotePreview.openGraphPreview?.type === 'video'
    ? loadedRemotePreview
    : null;
  const prefersRemotePreview = isRezka || isVk;
  const remoteItemPreview = prefersRemotePreview && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const tiktokEmbedPreview = usesTikTokEmbed ? getTikTokEmbedPreview(item) : null;
  const preview = usesTikTokEmbed
    ? tiktokEmbedPreview ?? localPreview
    : instagramVideoPreview
      ? instagramVideoPreview
      : prefersRemotePreview
        ? remoteItemPreview ?? localPreview
        : isReddit && remoteItemPreview?.type === 'video'
          ? remoteItemPreview
          : localPreview ?? remoteItemPreview;

  return { preview, remoteItemPreview, tiktokEmbedPreview };
}

function resolveVisiblePreview({
  preview,
  tiktokEmbedPreview,
  previewFailures,
  hasLiquipediaMatch,
}: {
  preview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
  previewFailures: number;
  hasLiquipediaMatch: boolean;
}): FeedItemPreview | null {
  if (hasLiquipediaMatch) return null;
  if (previewFailures === 1 && preview?.type === 'video') {
    return tiktokEmbedPreview ?? (preview.poster
      ? { src: preview.poster, alt: preview.alt }
      : null);
  }
  const fallbackPreview = getFallbackPreview(preview);
  if (previewFailures === 1 && fallbackPreview) return fallbackPreview;
  return previewFailures > 0 ? null : preview;
}

function getFallbackPreview(preview: FeedItemPreview | null): FeedItemPreview | null {
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  return preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
}

function resolveMetadata({
  item,
  analysis,
  nsfwMode,
  remotePreview,
  visiblePreview,
  remoteItemPreview,
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  visiblePreview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
}): FeedItemCardMetadata {
  const {
    hostname,
    provider,
    matreshkaVideoId,
    sasflixPublicationId,
    twitchChannel,
    youtubeVideoId,
  } = analysis;
  const display = getFeedItemProviderDisplayFacts(provider);
  const loading = getFeedItemProviderLoadingRules(provider);
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const isHltv = loading.metadata === 'hltv';
  const hltvSnapshot = getHltvSnapshot(remotePreview.openGraphPreview?.providerData);
  const isSimpleImage = display.supportsSimpleImage && isImagePreview(visiblePreview);
  const description = loading.description === 'vk'
    ? getFeedItemDescription(item.text, item.title)
    : null;
  // Prefer parsed match data over HLTV's generated screenshot, which can capture a 404 page.
  const hltvMatchTeams = isHltv && hltvSnapshot?.teams
    ? hltvSnapshot.teams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && hltvSnapshot?.status === 'over'
    ? hltvSnapshot.score
    : null;
  const oneFootballSnapshot = getOneFootballSnapshot(remotePreview.openGraphPreview?.providerData);

  return {
    hostname,
    provider,
    variant: resolveFeedItemProviderVariant(provider, {
      youtubeVideoId,
      twitchChannel,
      matreshkaVideoId,
      sasflixPublicationId,
      isSimpleImage,
      isInstagramPhoto: display.showInstagramIdentity && isImagePreview(visiblePreview),
    }),
    imagePreview: resolveImagePreview({
      isHltv,
      isReddit: isRedditUrl(analysis.url),
      visiblePreview,
      remotePreviewSource: remoteItemPreview?.src,
    }),
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
    description,
    isNsfw,
    shouldBlurNsfw,
    shouldHideNsfw,
    hltvMatchTeams,
    hltvSnapshot,
    hltvImageScore,
    oneFootballSnapshot,
  };
}

function resolveImagePreview({
  isHltv,
  isReddit,
  visiblePreview,
  remotePreviewSource,
}: {
  isHltv: boolean;
  isReddit: boolean;
  visiblePreview: FeedItemPreview | null;
  remotePreviewSource: string | undefined;
}): FeedItemCardImagePreview {
  if (!isImagePreview(visiblePreview)) return { type: 'none' };
  if (visiblePreview.src.startsWith('/bff/reddit-preview-image?')) {
    return { type: 'generated', source: isReddit ? 'reddit' : 'other' };
  }
  if (isHltv && visiblePreview.src === remotePreviewSource) return { type: 'hltv' };
  return { type: 'none' };
}

function isImagePreview(
  preview: FeedItemPreview | null,
): preview is FeedItemPreview & { type?: undefined } {
  return Boolean(preview && preview.type === undefined);
}

function resolveDescriptor({
  provider,
  variant,
  imagePreview,
}: {
  provider: FeedItemProvider;
  variant: FeedItemCardVariant;
  imagePreview: FeedItemCardImagePreview;
}): FeedItemCardPresentationDescriptor {
  const display = getFeedItemProviderDisplayFacts(provider);

  return {
    preview: resolvePreviewDescriptor(variant, display),
    copy: resolveCopyDescriptor(provider, variant, imagePreview, display.isShortVideo),
    showInstagramIdentity: display.showInstagramIdentity,
    showHltvCountdown: display.supplementary === 'hltv',
    showTikTokComments: display.supplementary === 'tiktok',
  };
}

function resolvePreviewDescriptor(
  variant: FeedItemCardVariant,
  display: ReturnType<typeof getFeedItemProviderDisplayFacts>,
): FeedItemCardPresentationDescriptor['preview'] {
  switch (variant.type) {
    case 'matreshka': return { type: 'matreshka', videoId: variant.videoId };
    case 'sasflix': return { type: 'sasflix', publicationId: variant.publicationId };
    case 'youtube': return { type: 'youtube', videoId: variant.videoId };
    case 'twitch': return { type: 'twitch', channel: variant.channel };
    case 'instagram':
    case 'liquipedia':
    case 'simple-image':
    case 'standard':
    case 'tiktok':
      return {
        type: 'media',
        isShortVideo: display.isShortVideo,
        isTikTok: display.isTikTok,
      };
    default: return assertNever(variant);
  }
}

function resolveCopyDescriptor(
  provider: FeedItemProvider,
  variant: FeedItemCardVariant,
  imagePreview: FeedItemCardImagePreview,
  isShortVideo: boolean,
): FeedItemCardPresentationDescriptor['copy'] {
  if (provider === 'vk') return 'standard';
  if (imagePreview.type !== 'none' || isShortVideo) return 'none';
  switch (variant.type) {
    case 'matreshka':
    case 'sasflix':
    case 'youtube':
    case 'twitch':
    case 'simple-image': return variant.type;
    case 'instagram':
    case 'liquipedia':
    case 'standard':
    case 'tiktok': return 'standard';
    default: return assertNever(variant);
  }
}

function canReadFeedItemArticle({
  provider,
  hostname,
  openGraphPreview,
}: Pick<FeedItemCardPresentation, 'provider' | 'hostname' | 'openGraphPreview'>): boolean {
  if (provider === 'vk') return false;
  return openGraphPreview?.type?.toLowerCase() === 'article'
    || hostname === 'trashbox.ru'
    || hostname?.endsWith('.trashbox.ru') === true;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item variant: ${JSON.stringify(value)}`);
}
