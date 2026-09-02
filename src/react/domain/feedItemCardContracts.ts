import type {
  HltvMatchSnapshot,
  LiquipediaMatchPreview,
  OneFootballMatchSnapshot,
  OpenGraphPreview,
} from '../../../shared/previewContracts';

import type { FeedItem } from '../types';
import type {
  FeedItemPreview,
  FeedItemProviderViewModel,
} from './feedItemPreviewTypes';

export type NsfwMode = 'show' | 'blur' | 'hide';

export type RemotePreview = {
  liquipediaMatch: LiquipediaMatchPreview | null;
  openGraphPreview: OpenGraphPreview | null;
};

export type RemotePreviewSource = 'none' | 'open-graph' | 'liquipedia';

export type FeedItemCardImagePreview =
  | { type: 'none' }
  | { type: 'generated'; source: 'reddit' | 'other' }
  | { type: 'hltv' };

type FeedItemCardCommonMetadata = {
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

export type FeedItemCardMetadata = FeedItemProviderViewModel extends infer Provider
  ? Provider extends FeedItemProviderViewModel
    ? FeedItemCardCommonMetadata & Provider
    : never
  : never;

export type FeedItemCardPresentation = FeedItemCardMetadata & {
  item: FeedItem;
  canReadArticle: boolean;
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
};
