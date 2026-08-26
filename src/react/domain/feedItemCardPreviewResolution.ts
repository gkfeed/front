import {
  getRemoteFeedItemPreview,
  getTikTokBrokerPreview,
  getTikTokEmbedPreview,
  isRedditUrl,
  isRezkaUrl,
  type FeedItemPreview,
} from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
import { getFeedItemProviderPolicy } from './feedItemProviderPolicies';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { RemotePreview } from './feedItemCardContracts';
import type { FeedItem } from '../types';
import type { TikTokPreviewMode } from './tiktokPreview';

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
  const isReddit = isRedditUrl(url);
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && policy.remotePreview
    && (isReddit || isRezka || !(localPreview?.src && (!usesVkDescription || feedDescription)));
}

export function resolveFeedItemCardPreviews({
  item,
  analysis,
  remotePreview,
  tiktokPreviewMode = 'embed',
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  remotePreview: RemotePreview;
  tiktokPreviewMode?: TikTokPreviewMode;
}): FeedItemCardPreviewResolution {
  const { localPreview } = analysis;
  const policy = getFeedItemProviderPolicy(analysis.provider);
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(analysis.url);
  const isReddit = isRedditUrl(analysis.url);
  const usesTikTokEmbed = policy.previewMode === 'tiktok-embed';
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const remoteItemPreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const tiktokEmbedPreview = usesTikTokEmbed ? getTikTokEmbedPreview(item) : null;
  const tiktokBrokerPreview = usesTikTokEmbed && tiktokPreviewMode === 'broker'
    ? getTikTokBrokerPreview(item)
    : null;
  const preview = usesTikTokEmbed
    ? tiktokBrokerPreview ?? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remoteItemPreview ?? localPreview
      : isReddit && remoteItemPreview?.type === 'video'
        ? remoteItemPreview
      : localPreview ?? remoteItemPreview;

  return { preview, remoteItemPreview, tiktokEmbedPreview };
}
