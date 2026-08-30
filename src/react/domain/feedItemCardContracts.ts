import type {
  HltvMatchSnapshot,
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../../shared/previewContracts';

import type { FeedItem } from '../types';
import type {
  FeedItemPreview,
  FeedItemAnalysis,
} from './feedItemPreviewTypes';

export type NsfwMode = 'show' | 'blur' | 'hide';

export type RemotePreview = {
  liquipediaMatch: LiquipediaMatchPreview | null;
  openGraphPreview: OpenGraphPreview | null;
};

export type FeedItemCardVariant =
  | { type: 'standard' }
  | { type: 'matreshka'; videoId: string }
  | { type: 'sasflix'; publicationId: string }
  | { type: 'twitch'; channel: string }
  | { type: 'youtube'; videoId: string }
  | { type: 'tiktok' }
  | { type: 'instagram'; media: 'photo' | 'video' }
  | { type: 'liquipedia' }
  | { type: 'simple-image' };

export type FeedItemCardImagePreview =
  | { type: 'none' }
  | { type: 'generated'; source: 'reddit' | 'other' }
  | { type: 'hltv' };

export type FeedItemCardPreviewDescriptor =
  | { type: 'media'; isShortVideo: boolean; isTikTok: boolean }
  | { type: 'matreshka'; videoId: string }
  | { type: 'sasflix'; publicationId: string }
  | { type: 'twitch'; channel: string }
  | { type: 'youtube'; videoId: string };

export type FeedItemCardCopyDescriptor =
  | 'none'
  | 'youtube'
  | 'twitch'
  | 'matreshka'
  | 'sasflix'
  | 'simple-image'
  | 'standard';

export type FeedItemCardPresentationDescriptor = {
  className: string;
  preview: FeedItemCardPreviewDescriptor;
  copy: FeedItemCardCopyDescriptor;
  showInstagramIdentity: boolean;
  showHltvCountdown: boolean;
  showTikTokComments: boolean;
};

export type FeedItemCardVariantContext = {
  youtubeVideoId: string | null;
  twitchChannel: string | null;
  matreshkaVideoId: string | null;
  sasflixPublicationId: string | null;
  isSimpleImage: boolean;
  isInstagramPhoto: boolean;
};

export type FeedItemProviderAdapter = {
  supplementary: 'none' | 'hltv' | 'tiktok';
  isShortVideo: boolean;
  isTikTok: boolean;
  showInstagramIdentity: boolean;
  supportsSimpleImage: boolean;
  resolveVariant: (context: FeedItemCardVariantContext) => FeedItemCardVariant;
  classNames: (variant: FeedItemCardVariant) => readonly string[];
};

export type FeedItemCardMetadata = {
  hostname: string | null;
  provider: FeedItemAnalysis['provider'];
  variant: FeedItemCardVariant;
  imagePreview: FeedItemCardImagePreview;
  openGraphPreview: OpenGraphPreview | null;
  liquipediaMatch: RemotePreview['liquipediaMatch'];
  description: string | null;
  isNsfw: boolean;
  shouldBlurNsfw: boolean;
  shouldHideNsfw: boolean;
  hltvMatchTeams: HltvMatchSnapshot['teams'];
  hltvSnapshot: HltvMatchSnapshot | null;
  hltvImageScore: [string, string] | null;
};

export type FeedItemCardPresentation = FeedItemCardMetadata & {
  item: FeedItem;
  canReadArticle: boolean;
  descriptor: FeedItemCardPresentationDescriptor;
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
};
