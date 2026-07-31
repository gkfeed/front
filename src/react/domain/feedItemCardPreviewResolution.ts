import {
  getRemoteFeedItemPreview,
  getTikTokEmbedPreview,
  isRezkaUrl,
  type FeedItemPreview,
} from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
import { getFeedItemProviderAdapter } from './feedItemProviders';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { FeedItem } from '../types';
import type { RemotePreview } from '../services/remotePreview';

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
  const adapter = getFeedItemProviderAdapter(analysis.provider);
  const isRezka = isRezkaUrl(url);
  const usesVkDescription = adapter.description === 'vk';
  const feedDescription = usesVkDescription
    ? getFeedItemDescription(item.text, item.title)
    : null;

  return !shouldHideNsfw
    && adapter.remotePreview
    && (isRezka || !(localPreview?.src && (!usesVkDescription || feedDescription)));
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
  const adapter = getFeedItemProviderAdapter(analysis.provider);
  const localPreviewSource = localPreview?.src;
  const isRezka = isRezkaUrl(analysis.url);
  const usesTikTokEmbed = adapter.previewMode === 'tiktok-embed';
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const remoteItemPreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const tiktokEmbedPreview = usesTikTokEmbed ? getTikTokEmbedPreview(item) : null;
  const preview = usesTikTokEmbed
    ? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remoteItemPreview ?? localPreview
      : localPreview ?? remoteItemPreview;

  return { preview, remoteItemPreview, tiktokEmbedPreview };
}
