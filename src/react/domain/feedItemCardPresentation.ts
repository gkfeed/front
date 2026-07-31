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

export type FeedItemCardVariant =
  | { type: 'standard' }
  | { type: 'youtube'; videoId: string }
  | { type: 'tiktok' }
  | { type: 'instagram'; media: 'photo' | 'video' }
  | { type: 'liquipedia' }
  | { type: 'simple-image' };

export type FeedItemCardImagePreview =
  | { type: 'none' }
  | { type: 'generated'; source: 'reddit' | 'other' }
  | { type: 'hltv' };

export type FeedItemCardPresentation = {
  item: FeedItem;
  hostname: string | null;
  provider: FeedItemAnalysis['provider'];
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
  const isTikTok = provider === 'tiktok';
  const isInstagram = provider === 'instagram';
  const isReddit = isRedditUrl(itemUrl);
  const isRezka = isRezkaUrl(itemUrl);
  const isVk = provider === 'vk';
  const isHltv = provider === 'hltv';
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
  const imagePreview = getImagePreviewType({
    provider,
    isReddit,
    visiblePreview,
    remotePreviewSource: remoteItemPreview?.src,
  });
  const isSimpleImage = provider === 'generic' && isImagePreview(visiblePreview);
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
  const variant = getCardVariant({
    provider,
    youtubeVideoId,
    isSimpleImage,
    isInstagramPhoto: isInstagram && isImagePreview(visiblePreview),
  });

  return {
    item,
    hostname,
    provider,
    variant,
    imagePreview,
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
    preview,
    visiblePreview,
    description,
    isNsfw,
    shouldBlurNsfw,
    shouldHideNsfw,
    hltvMatchTeams,
    hltvImageScore,
  };
}

function getImagePreviewType({
  provider,
  isReddit,
  visiblePreview,
  remotePreviewSource,
}: {
  provider: FeedItemAnalysis['provider'];
  isReddit: boolean;
  visiblePreview: FeedItemPreview | null;
  remotePreviewSource: string | undefined;
}): FeedItemCardImagePreview {
  if (!isImagePreview(visiblePreview)) return { type: 'none' };
  if (visiblePreview.src.startsWith('/api/bff/reddit-preview-image?')) {
    return { type: 'generated', source: isReddit ? 'reddit' : 'other' };
  }
  if (provider === 'hltv' && visiblePreview.src === remotePreviewSource) return { type: 'hltv' };
  return { type: 'none' };
}

function isImagePreview(
  preview: FeedItemPreview | null,
): preview is FeedItemPreview & { type?: undefined } {
  return Boolean(preview && preview.type === undefined);
}

function getCardVariant({
  provider,
  youtubeVideoId,
  isSimpleImage,
  isInstagramPhoto,
}: {
  provider: FeedItemAnalysis['provider'];
  youtubeVideoId: string | null;
  isSimpleImage: boolean;
  isInstagramPhoto: boolean;
}): FeedItemCardVariant {
  if (provider === 'youtube' && youtubeVideoId) return { type: 'youtube', videoId: youtubeVideoId };
  if (provider === 'tiktok') return { type: 'tiktok' };
  if (provider === 'instagram') return {
    type: 'instagram',
    media: isInstagramPhoto ? 'photo' : 'video',
  };
  if (provider === 'liquipedia') return { type: 'liquipedia' };
  if (isSimpleImage) return { type: 'simple-image' };
  return { type: 'standard' };
}
