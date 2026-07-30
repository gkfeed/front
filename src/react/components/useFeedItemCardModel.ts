import { useEffect, useState } from 'react';

import {
  analyzeFeedItem,
  getRemoteFeedItemPreview,
  getTikTokEmbedPreview,
  isGenericHltvPreview,
  isRedditUrl,
  isRezkaUrl,
  type FeedItemPreview,
} from '../domain/feedItemPreview';
import { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';
import { isNsfwLink } from './nsfw';

export type FeedItemCardModel = {
  item: FeedItem;
  cardRef: ReturnType<typeof useFeedItemRemotePreview>['cardRef'];
  hostname: string;
  provider: ReturnType<typeof analyzeFeedItem>['provider'];
  youtubeVideoId: string | null;
  openGraphPreview: ReturnType<typeof useFeedItemRemotePreview>['openGraphPreview'];
  liquipediaMatch: ReturnType<typeof useFeedItemRemotePreview>['liquipediaMatch'];
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
  description: string | null;
  isNsfw: boolean;
  shouldBlurNsfw: boolean;
  shouldHideNsfw: boolean;
  isYoutube: boolean;
  isTikTok: boolean;
  isInstagram: boolean;
  isShortVideo: boolean;
  isReddit: boolean;
  isHltv: boolean;
  isLiquipedia: boolean;
  isInstagramPhoto: boolean;
  isSimpleImageCard: boolean;
  isImagePreviewOnly: boolean;
  isPreviewPending: boolean;
  hltvMatchTeams: NonNullable<ReturnType<typeof useFeedItemRemotePreview>['openGraphPreview']>['matchTeams'];
  hltvImageScore: [string, string] | null;
  previewStatus: ReturnType<typeof useFeedItemRemotePreview>['previewStatus'];
  onPreviewError: () => void;
};

export function useFeedItemCardModel(item: FeedItem): FeedItemCardModel {
  const { nsfwMode } = useNsfwPreferences();
  const analysis = analyzeFeedItem(item);
  const { hostname, url: itemUrl, provider, localPreview, youtubeVideoId } = analysis;
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const localPreviewSource = localPreview?.src;
  const isYoutube = provider === 'youtube';
  const isTikTok = provider === 'tiktok';
  const isInstagram = provider === 'instagram';
  const isShortVideo = isTikTok || isInstagram;
  const isReddit = isRedditUrl(itemUrl);
  const isRezka = isRezkaUrl(itemUrl);
  const isVk = provider === 'vk';
  const isHltv = provider === 'hltv';
  const isLiquipedia = provider === 'liquipedia';
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;
  const shouldLoadRemotePreview = !shouldHideNsfw
    && !isTikTok
    && (isRezka || !(localPreviewSource && (!isVk || feedDescription)));
  const {
    cardRef,
    openGraphPreview,
    liquipediaMatch,
    previewStatus,
  } = useFeedItemRemotePreview(item.link, shouldLoadRemotePreview, isLiquipedia, isHltv);
  const loadedRemotePreview = getRemoteFeedItemPreview(openGraphPreview, item.title);
  const remotePreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const description = isVk
    ? feedDescription ?? getFeedItemDescription(openGraphPreview?.description ?? '', item.title)
    : null;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remotePreview ?? localPreview
      : localPreview ?? remotePreview;
  const [previewFailures, setPreviewFailures] = useState(0);
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  const fallbackPreview: FeedItemPreview | null = preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
  const visiblePreview = liquipediaMatch ? null : previewFailures === 1 && preview?.type === 'video'
    ? tiktokEmbedPreview ?? (preview.poster ? { src: preview.poster, alt: preview.alt } : null)
    : previewFailures === 1 && fallbackPreview
      ? fallbackPreview
      : previewFailures > 0 ? null : preview;
  const isInstagramPhoto = isInstagram && visiblePreview?.type === undefined;
  const isSimpleImageCard = provider === 'generic'
    && Boolean(visiblePreview && visiblePreview.type === undefined);
  const isImagePreviewOnly = Boolean(
    visiblePreview
    && visiblePreview.type === undefined
    && (
      visiblePreview.src.startsWith('/api/bff/reddit-preview-image?')
      || (isHltv && visiblePreview.src === remotePreview?.src)
    ),
  );
  const hltvMatchTeams = isHltv
    && visiblePreview
    && visiblePreview.type === undefined
    && (isGenericHltvPreview(visiblePreview.src) || openGraphPreview?.matchStatus === 'live')
    ? openGraphPreview?.matchTeams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && openGraphPreview?.matchStatus === 'over'
    ? openGraphPreview.matchScore ?? null
    : null;
  const isPreviewPending = shouldLoadRemotePreview && !localPreview && previewStatus === 'pending';

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  return {
    item,
    cardRef,
    hostname,
    provider,
    youtubeVideoId,
    openGraphPreview,
    liquipediaMatch,
    preview,
    visiblePreview,
    description,
    isNsfw,
    shouldBlurNsfw,
    shouldHideNsfw,
    isYoutube,
    isTikTok,
    isInstagram,
    isShortVideo,
    isReddit,
    isHltv,
    isLiquipedia,
    isInstagramPhoto,
    isSimpleImageCard,
    isImagePreviewOnly,
    isPreviewPending,
    hltvMatchTeams,
    hltvImageScore,
    previewStatus,
    onPreviewError: () => setPreviewFailures((failures) => failures + 1),
  };
}

function getFeedItemDescription(content: string, title: string): string | null {
  if (!content) return null;

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
  const description = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!description || description.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) return null;
  return description;
}
