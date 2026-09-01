import {
  buildFeedItemCardPresentation,
  type FeedItemCardPresentation,
} from '../domain/feedItemCardPresentation';
import { useFeedItemCardResource } from '../hooks/useFeedItemCardResource';
import type { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import type { FeedItem } from '../types';

export type FeedItemCardRenderFacts = Pick<
  FeedItemCardPresentation,
  | 'item'
  | 'hostname'
  | 'provider'
  | 'variant'
  | 'imagePreview'
  | 'liquipediaMatch'
  | 'description'
  | 'canReadArticle'
  | 'descriptor'
  | 'visiblePreview'
  | 'hltvMatchTeams'
  | 'hltvSnapshot'
  | 'hltvImageScore'
  | 'oneFootballSnapshot'
> & {
  videoSrc: string | null;
  isPreviewPending: boolean;
  previewStatus: ReturnType<typeof useFeedItemRemotePreview>['previewStatus'];
  onPreviewError: () => void;
};

export type FeedItemCardModel = FeedItemCardPresentation & {
  cardRef: ReturnType<typeof useFeedItemRemotePreview>['cardRef'];
  isPreviewPending: boolean;
  previewStatus: ReturnType<typeof useFeedItemRemotePreview>['previewStatus'];
  onPreviewError: () => void;
  renderFacts: FeedItemCardRenderFacts;
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

  const renderFacts: FeedItemCardRenderFacts = {
    item: presentation.item,
    hostname: presentation.hostname,
    provider: presentation.provider,
    variant: presentation.variant,
    imagePreview: presentation.imagePreview,
    liquipediaMatch: presentation.liquipediaMatch,
    description: presentation.description,
    canReadArticle: presentation.canReadArticle,
    descriptor: presentation.descriptor,
    visiblePreview: presentation.visiblePreview,
    hltvMatchTeams: presentation.hltvMatchTeams,
    hltvSnapshot: presentation.hltvSnapshot,
    hltvImageScore: presentation.hltvImageScore,
    oneFootballSnapshot: presentation.oneFootballSnapshot,
    videoSrc: presentation.openGraphPreview?.video ?? null,
    isPreviewPending: resource.isPreviewPending,
    previewStatus: resource.previewStatus,
    onPreviewError: resource.onPreviewError,
  };

  return {
    ...presentation,
    cardRef: resource.cardRef,
    isPreviewPending: resource.isPreviewPending,
    previewStatus: resource.previewStatus,
    onPreviewError: resource.onPreviewError,
    renderFacts,
  };
}
