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
import type {
  FeedItemCardImagePreview,
  FeedItemCardPresentationDescriptor,
  FeedItemCardVariant,
} from './feedItemProviders';

export type NsfwMode = 'show' | 'blur' | 'hide';

export type RemotePreview = {
  liquipediaMatch: LiquipediaMatchPreview | null;
  openGraphPreview: OpenGraphPreview | null;
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
  descriptor: FeedItemCardPresentationDescriptor;
  preview: FeedItemPreview | null;
  visiblePreview: FeedItemPreview | null;
};
