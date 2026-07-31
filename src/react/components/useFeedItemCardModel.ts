import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { analyzeFeedItem } from '../domain/feedItemPreview';
import {
  buildFeedItemCardPresentation,
  shouldLoadRemotePreview,
  type FeedItemCardPresentation,
} from '../domain/feedItemCardPresentation';
import { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';
import { isNsfwLink } from '../domain/nsfw';

export type FeedItemCardModel = FeedItemCardPresentation & {
  cardRef: ReturnType<typeof useFeedItemRemotePreview>['cardRef'];
  isPreviewPending: boolean;
  previewStatus: ReturnType<typeof useFeedItemRemotePreview>['previewStatus'];
  onPreviewError: () => void;
};

export function useFeedItemCardModel(item: FeedItem): FeedItemCardModel {
  const { t } = useTranslation();
  const { nsfwMode } = useNsfwPreferences();
  const analysis = analyzeFeedItem(item, t);
  const shouldHideNsfw = isNsfwLink(item.link) && nsfwMode === 'hide';
  const shouldLoadRemote = shouldLoadRemotePreview(item, analysis, shouldHideNsfw);
  const {
    cardRef,
    openGraphPreview,
    liquipediaMatch,
    previewStatus,
  } = useFeedItemRemotePreview(
    item.link,
    shouldLoadRemote,
    analysis.provider === 'liquipedia',
    analysis.provider === 'hltv',
  );
  const [previewFailures, setPreviewFailures] = useState(0);
  const presentation = buildFeedItemCardPresentation({
    item,
    analysis,
    nsfwMode,
    remotePreview: { openGraphPreview, liquipediaMatch },
    previewFailures,
    t,
  });
  const isPreviewPending = shouldLoadRemote && !analysis.localPreview && previewStatus === 'pending';

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  return {
    ...presentation,
    cardRef,
    isPreviewPending,
    previewStatus,
    onPreviewError: () => setPreviewFailures((failures) => failures + 1),
  };
}
