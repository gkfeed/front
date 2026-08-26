import { useEffect, useState } from 'react';

import { isNsfwLink } from '../domain/nsfw';
import { analyzeFeedItem } from '../domain/feedItemPreview';
import { shouldLoadRemotePreview } from '../domain/feedItemCardPresentation';
import { useFeedItemRemotePreview } from './useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { useTikTokPreviewPreferences } from '../state/useTikTokPreviewPreferences';
import type { FeedItem } from '../types';

export function useFeedItemCardResource(item: FeedItem) {
  const { nsfwMode } = useNsfwPreferences();
  const { mode: tiktokPreviewMode } = useTikTokPreviewPreferences();
  const analysis = analyzeFeedItem(item);
  const shouldHideNsfw = isNsfwLink(item.link) && nsfwMode === 'hide';
  const shouldLoadRemote = shouldLoadRemotePreview(item, analysis, shouldHideNsfw);
  const remotePreview = useFeedItemRemotePreview(
    item.link,
    shouldLoadRemote,
    analysis.provider === 'liquipedia',
    analysis.provider === 'hltv',
  );
  const [previewFailures, setPreviewFailures] = useState(0);

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  return {
    analysis,
    nsfwMode,
    tiktokPreviewMode,
    shouldHideNsfw,
    cardRef: remotePreview.cardRef,
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
    previewStatus: remotePreview.previewStatus,
    previewFailures,
    isPreviewPending: shouldLoadRemote && !analysis.localPreview && remotePreview.previewStatus === 'pending',
    onPreviewError: () => setPreviewFailures((failures) => failures + 1),
  };
}
