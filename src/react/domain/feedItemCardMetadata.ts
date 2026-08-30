import { isRedditUrl, type FeedItemPreview } from './feedItemPreview';
import { getFeedItemDescription } from './feedItemDescription';
import { getFeedItemProviderAdapter } from './feedItemProviderPresentation';
import { getFeedItemProviderPolicy } from './feedItemProviderPolicies';
import { isNsfwLink } from './nsfw';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import type {
  FeedItemCardImagePreview,
  FeedItemCardMetadata,
  NsfwMode,
  RemotePreview,
} from './feedItemCardContracts';
import type { FeedItem } from '../types';

export type { FeedItemCardMetadata } from './feedItemCardContracts';

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
  const {
    hostname,
    provider,
    matreshkaVideoId,
    sasflixPublicationId,
    twitchChannel,
    youtubeVideoId,
  } = analysis;
  const adapter = getFeedItemProviderAdapter(provider);
  const policy = getFeedItemProviderPolicy(provider);
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const isReddit = isRedditUrl(analysis.url);
  const isHltv = policy.metadata === 'hltv';
  const hltvSnapshot = remotePreview.openGraphPreview?.providerData?.provider === 'hltv'
    ? remotePreview.openGraphPreview.providerData.snapshot
    : null;
  const isSimpleImage = adapter.supportsSimpleImage && isImagePreview(visiblePreview);
  const feedDescription = policy.description === 'vk'
    ? getFeedItemDescription(item.text, item.title)
    : null;
  const description = policy.description === 'vk'
    ? feedDescription
    : null;
  // Prefer the parsed match data over HLTV's generated screenshot. The screenshot
  // endpoint can return a captured 404 page even when the match page itself is valid.
  const hltvMatchTeams = isHltv && hltvSnapshot?.teams
    ? hltvSnapshot.teams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && hltvSnapshot?.status === 'over'
    ? hltvSnapshot.score
    : null;

  return {
    hostname,
    provider,
    variant: adapter.resolveVariant({
      youtubeVideoId,
      twitchChannel,
      matreshkaVideoId,
      sasflixPublicationId,
      isSimpleImage,
      isInstagramPhoto: adapter.showInstagramIdentity && isImagePreview(visiblePreview),
    }),
    imagePreview: getImagePreviewType({
      isHltv,
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
    hltvSnapshot,
    hltvImageScore,
  };
}

function getImagePreviewType({
  isHltv,
  isReddit,
  visiblePreview,
  remotePreviewSource,
}: {
  isHltv: boolean;
  isReddit: boolean;
  visiblePreview: FeedItemPreview | null;
  remotePreviewSource: string | undefined;
}): FeedItemCardImagePreview {
  if (!isImagePreview(visiblePreview)) return { type: 'none' };
  if (visiblePreview.src.startsWith('/bff/reddit-preview-image?')) {
    return { type: 'generated', source: isReddit ? 'reddit' : 'other' };
  }
  if (isHltv && visiblePreview.src === remotePreviewSource) return { type: 'hltv' };
  return { type: 'none' };
}

function isImagePreview(
  preview: FeedItemPreview | null,
): preview is FeedItemPreview & { type?: undefined } {
  return Boolean(preview && preview.type === undefined);
}
