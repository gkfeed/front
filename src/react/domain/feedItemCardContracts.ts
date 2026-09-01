import type {
  HltvMatchSnapshot,
  LiquipediaMatchPreview,
  OneFootballMatchSnapshot,
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

export type RemotePreviewSource = 'none' | 'open-graph' | 'liquipedia';

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
  renderer: FeedItemAnalysis['provider'];
  preview: FeedItemCardPreviewDescriptor;
  copy: FeedItemCardCopyDescriptor;
  imagePresentation: 'standard' | 'vk';
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
  oneFootballSnapshot: OneFootballMatchSnapshot | null;
};

export type FeedItemCardPresentation = FeedItemCardMetadata & {
  item: FeedItem;
  canReadArticle: boolean;
  descriptor: FeedItemCardPresentationDescriptor;
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
  renderFacts: FeedItemCardPresentationRenderFacts;
};

/** Framework-agnostic, completed input for the React renderer seam. */
export type FeedItemCardPresentationRenderFacts = Pick<
  FeedItemCardPresentation,
  | 'item'
  | 'hostname'
  | 'variant'
  | 'imagePreview'
  | 'liquipediaMatch'
  | 'description'
  | 'canReadArticle'
  | 'descriptor'
  | 'visiblePreview'
  | 'hltvMatchTeams'
  | 'hltvSnapshot'
  | 'hltvImageScore'
  | 'oneFootballSnapshot'
> & {
  videoSrc: string | null;
};
