import { getFeedItemCardPresentationDescriptor } from './feedItemCardDescriptor';
import { resolveFeedItemCardMetadata } from './feedItemCardMetadata';
import {
  resolveFeedItemCardPreviews,
} from './feedItemCardPreviewResolution';
import { resolveVisibleFeedItemCardPreview } from './feedItemCardPreviewVisibility';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type {
  FeedItemCardPresentation,
  NsfwMode,
  RemotePreview,
} from './feedItemCardContracts';
import type { FeedItem } from '../types';

export type {
  FeedItemCardPresentation,
} from './feedItemCardContracts';

export type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
} from './feedItemCardContracts';

export { shouldLoadRemotePreview } from './feedItemCardPreviewResolution';

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
  const previews = resolveFeedItemCardPreviews({ item, analysis, remotePreview });
  const visiblePreview = resolveVisibleFeedItemCardPreview({
    preview: previews.preview,
    tiktokEmbedPreview: previews.tiktokEmbedPreview,
    previewFailures,
    hasLiquipediaMatch: Boolean(remotePreview.liquipediaMatch),
  });
  const metadata = resolveFeedItemCardMetadata({
    item,
    analysis,
    nsfwMode,
    remotePreview,
    visiblePreview,
    remoteItemPreview: previews.remoteItemPreview,
  });
  const descriptor = getFeedItemCardPresentationDescriptor({
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
