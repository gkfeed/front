import { useEffect, useState } from 'react';

import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { resolveFeedItemPreviewPolicy } from '../domain/feedItemPreviewPolicy';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import { useFeedItemRemotePreview } from './useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';

export function useFeedItemCardResource(item: FeedItem) {
  const { nsfwMode } = useNsfwPreferences();
  const providerView = analyzeFeedItem(item);
  const previewPolicy = resolveFeedItemPreviewPolicy({
    item,
    providerView,
    nsfwMode,
    remotePreview: EMPTY_REMOTE_PREVIEW,
    previewFailures: 0,
  });
  const remotePreview = useFeedItemRemotePreview(item.link, {
    enabled: Boolean(previewPolicy.remoteRequest),
    source: previewPolicy.remoteRequest?.source ?? 'none',
    livePreview: previewPolicy.remoteRequest?.livePreview ?? 'none',
  });
  const [previewFailures, setPreviewFailures] = useState(0);

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  return {
    providerView,
    nsfwMode,
    shouldHideNsfw: previewPolicy.shouldHideNsfw,
    cardRef: remotePreview.cardRef,
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
    previewStatus: remotePreview.previewStatus,
    previewFailures,
    isPreviewPending: previewPolicy.showLoadingPlaceholder
      && remotePreview.previewStatus === 'pending',
    onPreviewError: () => setPreviewFailures((failures) => failures + 1),
  };
}
