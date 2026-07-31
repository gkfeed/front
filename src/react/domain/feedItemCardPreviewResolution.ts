import {
  getRemoteFeedItemPreview,
  getTikTokEmbedPreview,
  isRezkaUrl,
  type FeedItemPreview,
} from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
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
  const { provider, localPreview, url } = analysis;
  const isTikTok = provider === 'tiktok';
  const isVk = provider === 'vk';
  const isRezka = isRezkaUrl(url);
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;

  return !shouldHideNsfw
    && !isTikTok
    && (isRezka || !(localPreview?.src && (!isVk || feedDescription)));
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
  const { provider, localPreview } = analysis;
  const localPreviewSource = localPreview?.src;
  const isTikTok = provider === 'tiktok';
  const isRezka = isRezkaUrl(analysis.url);
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const remoteItemPreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remoteItemPreview ?? localPreview
      : localPreview ?? remoteItemPreview;

  return { preview, remoteItemPreview, tiktokEmbedPreview };
}
