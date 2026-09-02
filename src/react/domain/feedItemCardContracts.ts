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
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
};
