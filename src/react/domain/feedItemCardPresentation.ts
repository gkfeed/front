import type { OpenGraphPreview } from '../../../shared/previewContracts';

import {
  getRemoteFeedItemPreview,
  getTikTokEmbedPreview,
  isGenericHltvPreview,
  isRedditUrl,
  isRezkaUrl,
  type FeedItemPreview,
} from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
import { isNsfwLink } from './nsfw';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { FeedItem } from '../types';
import type { NsfwMode } from '../state/nsfwPreferencesContext';
import type { RemotePreview } from '../services/remotePreview';

export type FeedItemCardPresentation = {
  item: FeedItem;
  hostname: string | null;
  provider: FeedItemAnalysis['provider'];
  youtubeVideoId: string | null;
  openGraphPreview: OpenGraphPreview | null;
  liquipediaMatch: RemotePreview['liquipediaMatch'];
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
  hltvMatchTeams: NonNullable<OpenGraphPreview>['matchTeams'];
  hltvImageScore: [string, string] | null;
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
  const loadedRemotePreview = getRemoteFeedItemPreview(remotePreview.openGraphPreview, item.title);
  const remoteItemPreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const description = isVk
    ? feedDescription ?? getFeedItemDescription(remotePreview.openGraphPreview?.description ?? '', item.title)
    : null;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remoteItemPreview ?? localPreview
      : localPreview ?? remoteItemPreview;
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  const fallbackPreview: FeedItemPreview | null = preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
  const visiblePreview = remotePreview.liquipediaMatch ? null : previewFailures === 1 && preview?.type === 'video'
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
      || (isHltv && visiblePreview.src === remoteItemPreview?.src)
    ),
  );
  const hltvMatchTeams = isHltv
    && visiblePreview
    && visiblePreview.type === undefined
    && (isGenericHltvPreview(visiblePreview.src) || remotePreview.openGraphPreview?.matchStatus === 'live')
    ? remotePreview.openGraphPreview?.matchTeams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && remotePreview.openGraphPreview?.matchStatus === 'over'
    ? remotePreview.openGraphPreview.matchScore ?? null
    : null;

  return {
    item,
    hostname,
    provider,
    youtubeVideoId,
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
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
    hltvMatchTeams,
    hltvImageScore,
  };
}
