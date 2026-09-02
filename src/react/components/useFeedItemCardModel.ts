import {
  buildFeedItemCardPresentation,
  type FeedItemCardPresentation,
} from '../domain/feedItemCardPresentation';
import { useFeedItemCardResource } from '../hooks/useFeedItemCardResource';
import type { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import type { FeedItem } from '../types';

export type FeedItemCardModel = FeedItemCardPresentation & {
  cardRef: ReturnType<typeof useFeedItemRemotePreview>['cardRef'];
  isPreviewPending: boolean;
  previewStatus: ReturnType<typeof useFeedItemRemotePreview>['previewStatus'];
  onPreviewError: () => void;
};

export function useFeedItemCardModel(item: FeedItem): FeedItemCardModel {
  const resource = useFeedItemCardResource(item);
  const presentation = buildFeedItemCardPresentation({
    item,
    analysis: resource.analysis,
    nsfwMode: resource.nsfwMode,
    remotePreview: {
      openGraphPreview: resource.openGraphPreview,
      liquipediaMatch: resource.liquipediaMatch,
    },
    previewFailures: resource.previewFailures,
  });

  return {
    ...presentation,
    cardRef: resource.cardRef,
    isPreviewPending: resource.isPreviewPending,
    previewStatus: resource.previewStatus,
    onPreviewError: resource.onPreviewError,
  };
}
