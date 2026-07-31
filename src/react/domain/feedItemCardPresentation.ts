import type { HltvMatchSnapshot, OpenGraphPreview } from '../../../shared/previewContracts';

import {
  getFeedItemCardPresentationDescriptor,
  type FeedItemCardImagePreview,
  type FeedItemCardPresentationDescriptor,
  type FeedItemCardVariant,
} from './feedItemProviders';
import { resolveFeedItemCardMetadata } from './feedItemCardMetadata';
import {
  resolveFeedItemCardPreviews,
} from './feedItemCardPreviewResolution';
import { resolveVisibleFeedItemCardPreview } from './feedItemCardPreviewVisibility';
import type { FeedItemPreview } from './feedItemPreview';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { FeedItem } from '../types';
import type { NsfwMode } from '../state/nsfwPreferencesContext';
import type { RemotePreview } from '../services/remotePreview';

export type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
} from './feedItemProviders';

export type FeedItemCardPresentation = {
  item: FeedItem;
  hostname: string | null;
  provider: FeedItemAnalysis['provider'];
  descriptor: FeedItemCardPresentationDescriptor;
  variant: FeedItemCardVariant;
  imagePreview: FeedItemCardImagePreview;
  openGraphPreview: OpenGraphPreview | null;
  liquipediaMatch: RemotePreview['liquipediaMatch'];
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
  description: string | null;
  isNsfw: boolean;
  shouldBlurNsfw: boolean;
  shouldHideNsfw: boolean;
  hltvMatchTeams: HltvMatchSnapshot['teams'];
  hltvSnapshot: HltvMatchSnapshot | null;
  hltvImageScore: [string, string] | null;
};

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
    descriptor,
    preview: previews.preview,
    visiblePreview,
  };
}
