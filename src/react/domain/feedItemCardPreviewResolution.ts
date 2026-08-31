import {
  isRedditUrl,
  isRezkaUrl,
} from './feedItemUrls';
import { getRemoteFeedItemPreview } from './feedItemRemotePreview';
import { getTikTokEmbedPreview } from './tiktokPreview';
import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getFeedItemDescription } from './feedItemDescription';
import { getFeedItemProviderPolicy } from './feedItemProviderPolicies';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { RemotePreview } from './feedItemCardContracts';
import type { FeedItem } from '../types';
import { isInstagramMediaUrl } from './instagramPreview';

export type FeedItemCardPreviewResolution = {
  preview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
};

export function shouldLoadRemotePreview(
  item: FeedItem,
  analysis: FeedItemAnalysis,
  shouldHideNsfw: boolean,
): boolean {
  const { localPreview, url } = analysis;
  const policy = getFeedItemProviderPolicy(analysis.provider);
  const isRezka = isRezkaUrl(url);
  const usesVkDescription = policy.description === 'vk';
  const isVk = analysis.provider === 'vk';
  const isReddit = isRedditUrl(url);
  const needsInstagramMetadata = analysis.provider === 'instagram'
    && Boolean(url && isInstagramMediaUrl(url));
  const needsSasflixMetadata = analysis.provider === 'sasflix';
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && policy.remotePreview !== 'none'
    && (isReddit
      || isVk
      || isRezka
      || needsInstagramMetadata
      || needsSasflixMetadata
      || !(localPreview?.src && (!usesVkDescription || feedDescription)));
}

export function resolveFeedItemCardPreviews({
  item,
  analysis,
  remotePreview,
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  remotePreview: RemotePreview;
}): FeedItemCardPreviewResolution {
  const { localPreview } = analysis;
  const policy = getFeedItemProviderPolicy(analysis.provider);
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(analysis.url);
  const isReddit = isRedditUrl(analysis.url);
  const isVk = analysis.provider === 'vk';
  const usesTikTokEmbed = policy.previewMode === 'tiktok-embed';
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
