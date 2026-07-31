import type { FeedItemCardPresentation, FeedItemCardImagePreview, FeedItemCardVariant } from './feedItemCardPresentation';
import { isGenericHltvPreview, isRedditUrl, type FeedItemPreview } from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
import { isNsfwLink } from './nsfw';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type { FeedItem } from '../types';
import type { NsfwMode } from '../state/nsfwPreferencesContext';
import type { RemotePreview } from '../services/remotePreview';

export type FeedItemCardMetadata = Pick<
  FeedItemCardPresentation,
  | 'hostname'
  | 'provider'
  | 'variant'
  | 'imagePreview'
  | 'openGraphPreview'
  | 'liquipediaMatch'
  | 'description'
  | 'isNsfw'
  | 'shouldBlurNsfw'
  | 'shouldHideNsfw'
  | 'hltvMatchTeams'
  | 'hltvImageScore'
>;

export function resolveFeedItemCardMetadata({
  item,
  analysis,
  nsfwMode,
  remotePreview,
  visiblePreview,
  remoteItemPreview,
}: {
  item: FeedItem;
  analysis: FeedItemAnalysis;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  visiblePreview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
}): FeedItemCardMetadata {
  const { hostname, provider, youtubeVideoId } = analysis;
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const isReddit = isRedditUrl(analysis.url);
  const isInstagram = provider === 'instagram';
  const isHltv = provider === 'hltv';
  const isSimpleImage = provider === 'generic' && isImagePreview(visiblePreview);
  const feedDescription = provider === 'vk' ? getFeedItemDescription(item.text, item.title) : null;
  const description = provider === 'vk'
    ? feedDescription ?? getFeedItemDescription(remotePreview.openGraphPreview?.description ?? '', item.title)
    : null;
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
    hostname,
    provider,
    variant: getCardVariant({
      provider,
      youtubeVideoId,
      isSimpleImage,
      isInstagramPhoto: isInstagram && isImagePreview(visiblePreview),
    }),
    imagePreview: getImagePreviewType({
      provider,
      isReddit,
      visiblePreview,
      remotePreviewSource: remoteItemPreview?.src,
    }),
    openGraphPreview: remotePreview.openGraphPreview,
    liquipediaMatch: remotePreview.liquipediaMatch,
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
