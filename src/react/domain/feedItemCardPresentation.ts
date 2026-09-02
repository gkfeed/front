import { isInstagramMediaUrl } from './instagramPreview';
import { isNsfwLink } from './nsfw';
import { getFeedItemDescription } from './feedItemDescription';
import {
  getFeedItemProviderLoadingRules,
} from './feedItemProviderPresentation';
import { getRemoteFeedItemPreview } from './feedItemRemotePreview';
import { isRedditUrl, isRezkaUrl } from './feedItemUrls';
import { getTikTokEmbedPreview } from './tiktokPreview';
import type {
  FeedItemPreview,
  FeedItemProviderViewModel,
} from './feedItemPreviewTypes';
import type {
  FeedItemCardImagePreview,
  FeedItemCardMetadata,
  FeedItemCardPresentation,
  NsfwMode,
  RemotePreview,
} from './feedItemCardContracts';
import type { FeedItem } from '../types';
import { getHltvSnapshot } from '../../../shared/providerData/hltv';
import { getOneFootballSnapshot } from '../../../shared/providerData/oneFootball';

export type { FeedItemCardPresentation } from './feedItemCardContracts';

export type {
  FeedItemCardImagePreview,
} from './feedItemCardContracts';

export function shouldLoadRemotePreview(
  item: FeedItem,
  providerView: FeedItemProviderViewModel,
  shouldHideNsfw: boolean,
): boolean {
  const { localPreview, url } = providerView;
  const loading = getFeedItemProviderLoadingRules(providerView.provider);
  const usesVkDescription = loading.description === 'vk';
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && loading.remotePreview !== 'none'
    && (isRedditUrl(url)
      || providerView.provider === 'vk'
      || isRezkaUrl(url)
      || (providerView.provider === 'instagram' && Boolean(url && isInstagramMediaUrl(url)))
      || providerView.provider === 'sasflix'
      || providerView.provider === 'onefootball'
      || !(localPreview?.src && (!usesVkDescription || feedDescription)));
}

export function buildFeedItemCardPresentation({
  item,
  providerView,
  nsfwMode,
  remotePreview,
  previewFailures,
}: {
  item: FeedItem;
  providerView: FeedItemProviderViewModel;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  previewFailures: number;
}): FeedItemCardPresentation {
  const previews = resolvePreviews({ item, providerView, remotePreview });
  const visiblePreview = resolveVisiblePreview({
    preview: previews.preview,
    tiktokEmbedPreview: previews.tiktokEmbedPreview,
    previewFailures,
    hasLiquipediaMatch: Boolean(remotePreview.liquipediaMatch),
  });
  const metadata = resolveMetadata({
    item,
    providerView,
    nsfwMode,
    remotePreview,
    visiblePreview,
    remoteItemPreview: previews.remoteItemPreview,
  });
  return {
    item,
    ...metadata,
    canReadArticle: canReadFeedItemArticle(metadata),
    preview: previews.preview,
    visiblePreview,
  };
}

function resolvePreviews({
  item,
  providerView,
  remotePreview,
}: {
  item: FeedItem;
  providerView: FeedItemProviderViewModel;
  remotePreview: RemotePreview;
}): {
  preview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
} {
  const { localPreview } = providerView;
  const loading = getFeedItemProviderLoadingRules(providerView.provider);
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(providerView.url);
  const isReddit = isRedditUrl(providerView.url);
  const isVk = providerView.provider === 'vk';
  const usesTikTokEmbed = loading.previewMode === 'tiktok-embed';
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const instagramVideoPreview = providerView.provider === 'instagram'
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
  providerView,
  nsfwMode,
  remotePreview,
  visiblePreview,
  remoteItemPreview,
}: {
  item: FeedItem;
  providerView: FeedItemProviderViewModel;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  visiblePreview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
}): FeedItemCardMetadata {
  const { provider } = providerView;
  const loading = getFeedItemProviderLoadingRules(provider);
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const isHltv = loading.metadata === 'hltv';
  const hltvSnapshot = getHltvSnapshot(remotePreview.openGraphPreview?.providerData);
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
    ...resolveProviderViewModel(providerView, visiblePreview),
    imagePreview: resolveImagePreview({
      isHltv,
      isReddit: isRedditUrl(providerView.url),
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

function resolveProviderViewModel(
  providerView: FeedItemProviderViewModel,
  visiblePreview: FeedItemPreview | null,
): FeedItemProviderViewModel {
  switch (providerView.provider) {
    case 'generic':
    case 'onefootball':
      return { ...providerView, simpleImage: isImagePreview(visiblePreview) };
    case 'instagram':
      return { ...providerView, media: isImagePreview(visiblePreview) ? 'photo' : 'video' };
    case 'hltv':
    case 'liquipedia':
    case 'matreshka':
    case 'sasflix':
    case 'tiktok':
    case 'twitch':
    case 'vk':
    case 'youtube':
      return providerView;
    default:
      return assertNever(providerView);
  }
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
  throw new Error(`Unsupported feed item provider: ${JSON.stringify(value)}`);
}
