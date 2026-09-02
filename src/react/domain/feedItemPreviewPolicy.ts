import type { FeedItem } from '../types';
import type {
  NsfwMode,
  RemotePreview,
  RemotePreviewSource,
} from './feedItemCardContracts';
import { getFeedItemDescription } from './feedItemDescription';
import { getRemoteFeedItemPreview } from './feedItemRemotePreview';
import { getFeedItemProviderLoadingRules } from './feedItemProviderPresentation';
import type { FeedItemProviderLoadingRules } from './feedItemProviderPresentation';
import type {
  FeedItemPreview,
  FeedItemProviderViewModel,
} from './feedItemPreviewTypes';
import { isRedditUrl, isRezkaUrl } from './feedItemUrls';
import { isInstagramMediaUrl } from './instagramPreview';
import { isNsfwLink } from './nsfw';
import { getTikTokEmbedPreview } from './tiktokPreview';

export type FeedItemRemotePreviewRequest = {
  source: Exclude<RemotePreviewSource, 'none'>;
  livePreview: 'none' | 'hltv';
};

export type FeedItemPreviewPolicy = {
  remoteRequest: FeedItemRemotePreviewRequest | null;
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  isNsfw: boolean;
  shouldBlurNsfw: boolean;
  shouldHideNsfw: boolean;
  showLoadingPlaceholder: boolean;
};

/** The single decision point for requesting and selecting feed item previews. */
export function resolveFeedItemPreviewPolicy({
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
}): FeedItemPreviewPolicy {
  const loading = getFeedItemProviderLoadingRules(providerView.provider);
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const remoteRequest = shouldRequestRemotePreview(item, providerView, loading, shouldHideNsfw)
    && loading.remotePreview !== 'none'
    ? { source: loading.remotePreview, livePreview: loading.livePreview }
    : null;
  const { preview, remoteItemPreview, tiktokEmbedPreview } = selectPreview(
    item,
    providerView,
    remotePreview,
    loading.previewMode,
  );

  const visiblePreview = shouldHideNsfw
    ? null
    : selectVisiblePreview(
      preview,
      tiktokEmbedPreview,
      previewFailures,
      Boolean(remotePreview.liquipediaMatch),
    );

  return {
    remoteRequest,
    preview,
    visiblePreview,
    remoteItemPreview,
    isNsfw,
    shouldBlurNsfw,
    shouldHideNsfw,
    showLoadingPlaceholder: loading.loadingPlaceholder === 'when-missing'
      && Boolean(remoteRequest)
      && !providerView.localPreview,
  };
}

function shouldRequestRemotePreview(
  item: FeedItem,
  providerView: FeedItemProviderViewModel,
  loading: FeedItemProviderLoadingRules,
  shouldHideNsfw: boolean,
): boolean {
  const { localPreview, url } = providerView;
  const usesVkDescription = loading.description === 'vk';
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && (isRedditUrl(url)
      || providerView.provider === 'vk'
      || isRezkaUrl(url)
      || (providerView.provider === 'instagram' && Boolean(url && isInstagramMediaUrl(url)))
      || providerView.provider === 'sasflix'
      || providerView.provider === 'onefootball'
      || !(localPreview?.src && (!usesVkDescription || feedDescription)));
}

function selectPreview(
  item: FeedItem,
  providerView: FeedItemProviderViewModel,
  remotePreview: RemotePreview,
  previewMode: 'local-first' | 'tiktok-embed',
): {
  preview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
} {
  const { localPreview } = providerView;
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(providerView.url);
  const isReddit = isRedditUrl(providerView.url);
  const isVk = providerView.provider === 'vk';
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const instagramVideoPreview = providerView.provider === 'instagram'
    && remotePreview.openGraphPreview?.type === 'video'
    ? loadedRemotePreview
    : null;
  const prefersRemotePreview = isRezka || isVk;
  const remoteItemPreview = prefersRemotePreview && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const tiktokEmbedPreview = previewMode === 'tiktok-embed'
    ? getTikTokEmbedPreview(item)
    : null;
  const preview = previewMode === 'tiktok-embed'
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

function selectVisiblePreview(
  preview: FeedItemPreview | null,
  tiktokEmbedPreview: FeedItemPreview | null,
  previewFailures: number,
  hasLiquipediaMatch: boolean,
): FeedItemPreview | null {
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
