import { useEffect, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { shouldLoadRemotePreview } from '../domain/feedItemCardPresentation';
import { getFeedItemProviderPolicy } from '../domain/feedItemProviderPolicies';
import { useFeedItemRemotePreview } from './useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';

export function useFeedItemCardResource(item: FeedItem) {
  const { nsfwMode } = useNsfwPreferences();
  const analysis = analyzeFeedItem(item);
  const providerPolicy = getFeedItemProviderPolicy(analysis.provider);
  const shouldHideNsfw = isNsfwLink(item.link) && nsfwMode === 'hide';
  const shouldLoadRemote = shouldLoadRemotePreview(item, analysis, shouldHideNsfw);
  const remotePreview = useFeedItemRemotePreview(item.link, {
    enabled: shouldLoadRemote,
    source: providerPolicy.remotePreview,
    livePreview: providerPolicy.livePreview,
  });
  const [previewFailures, setPreviewFailures] = useState(0);

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  return {
    analysis,
    nsfwMode,
    shouldHideNsfw,
    cardRef: remotePreview.cardRef,
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
    previewStatus: remotePreview.previewStatus,
    previewFailures,
    isPreviewPending: providerPolicy.loadingPlaceholder === 'when-missing'
      && shouldLoadRemote
      && !analysis.localPreview
      && remotePreview.previewStatus === 'pending',
    onPreviewError: () => setPreviewFailures((failures) => failures + 1),
  };
}
