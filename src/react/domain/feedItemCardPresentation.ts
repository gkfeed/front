import { getFeedItemDescription } from './feedItemDescription';
import {
  getFeedItemProviderLoadingRules,
} from './feedItemProviderPresentation';
import { resolveFeedItemPreviewPolicy } from './feedItemPreviewPolicy';
import { isRedditUrl } from './feedItemUrls';
import type {
  FeedItemPreview,
  FeedItemProviderViewModel,
} from './feedItemPreviewTypes';
import type {
  FeedItemCardImagePreview,
  FeedItemCardMetadata,
  FeedItemCardPresentation,
  NsfwMode,
  RemotePreview,
} from './feedItemCardContracts';
import type { FeedItem } from '../types';
import { getHltvSnapshot } from '../../../shared/providerData/hltv';
import { getOneFootballSnapshot } from '../../../shared/providerData/oneFootball';

export type { FeedItemCardPresentation } from './feedItemCardContracts';

export type {
  FeedItemCardImagePreview,
} from './feedItemCardContracts';

export function buildFeedItemCardPresentation({
  item,
  providerView,
  nsfwMode,
  remotePreview,
  previewFailures,
}: {
  item: FeedItem;
  providerView: FeedItemProviderViewModel;
  nsfwMode: NsfwMode;
  remotePreview: RemotePreview;
  previewFailures: number;
}): FeedItemCardPresentation {
  const previewPolicy = resolveFeedItemPreviewPolicy({
    item,
    providerView,
    nsfwMode,
    remotePreview,
    previewFailures,
  });
  const metadata = resolveMetadata({
    item,
    providerView,
    remotePreview,
    visiblePreview: previewPolicy.visiblePreview,
    remoteItemPreview: previewPolicy.remoteItemPreview,
    isNsfw: previewPolicy.isNsfw,
    shouldBlurNsfw: previewPolicy.shouldBlurNsfw,
    shouldHideNsfw: previewPolicy.shouldHideNsfw,
  });
  return {
    item,
    ...metadata,
    canReadArticle: canReadFeedItemArticle(metadata),
    preview: previewPolicy.preview,
    visiblePreview: previewPolicy.visiblePreview,
  };
}

function resolveMetadata({
  item,
  providerView,
  remotePreview,
  visiblePreview,
  remoteItemPreview,
  isNsfw,
  shouldBlurNsfw,
  shouldHideNsfw,
}: {
  item: FeedItem;
  providerView: FeedItemProviderViewModel;
  remotePreview: RemotePreview;
  visiblePreview: FeedItemPreview | null;
  remoteItemPreview: FeedItemPreview | null;
  isNsfw: boolean;
  shouldBlurNsfw: boolean;
  shouldHideNsfw: boolean;
}): FeedItemCardMetadata {
  const { provider } = providerView;
  const loading = getFeedItemProviderLoadingRules(provider);
  const isHltv = loading.metadata === 'hltv';
  const hltvSnapshot = getHltvSnapshot(remotePreview.openGraphPreview?.providerData);
  const description = loading.description === 'vk'
    ? getFeedItemDescription(item.text, item.title)
    : null;
  // Prefer parsed match data over HLTV's generated screenshot, which can capture a 404 page.
  const hltvMatchTeams = isHltv && hltvSnapshot?.teams
    ? hltvSnapshot.teams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && hltvSnapshot?.status === 'over'
    ? hltvSnapshot.score
    : null;
  const oneFootballSnapshot = getOneFootballSnapshot(remotePreview.openGraphPreview?.providerData);

  return {
    ...resolveProviderViewModel(providerView, visiblePreview),
    imagePreview: resolveImagePreview({
      isHltv,
      isReddit: isRedditUrl(providerView.url),
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
    oneFootballSnapshot,
  };
}

function resolveProviderViewModel(
  providerView: FeedItemProviderViewModel,
  visiblePreview: FeedItemPreview | null,
): FeedItemProviderViewModel {
  switch (providerView.provider) {
    case 'generic':
    case 'onefootball':
      return { ...providerView, simpleImage: isImagePreview(visiblePreview) };
    case 'instagram':
      return { ...providerView, media: isImagePreview(visiblePreview) ? 'photo' : 'video' };
    case 'hltv':
    case 'liquipedia':
    case 'matreshka':
    case 'sasflix':
    case 'tiktok':
    case 'twitch':
    case 'vk':
    case 'youtube':
      return providerView;
    default:
      return assertNever(providerView);
  }
}

function resolveImagePreview({
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

function canReadFeedItemArticle({
  provider,
  hostname,
  openGraphPreview,
}: Pick<FeedItemCardPresentation, 'provider' | 'hostname' | 'openGraphPreview'>): boolean {
  if (provider === 'vk') return false;
  return openGraphPreview?.type?.toLowerCase() === 'article'
    || hostname === 'trashbox.ru'
    || hostname?.endsWith('.trashbox.ru') === true;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item provider: ${JSON.stringify(value)}`);
}
