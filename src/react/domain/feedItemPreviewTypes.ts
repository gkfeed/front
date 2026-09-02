import type { FeedItem } from '../types';

export interface FeedItemPreview {
  src: string;
  alt: FeedItemPreviewAlt;
  type?: 'video' | 'embed';
  poster?: string;
  fallbackSrc?: string;
}

export type FeedItemPreviewAlt =
  | { kind: 'item'; title: string | null }
  | { kind: 'video'; title: string | null }
  | { kind: 'youtube'; title: string | null }
  | { kind: 'tiktok'; title: string | null }
  | { kind: 'twitch'; channel: string }
  | { kind: 'matreshka'; title: string | null }
  | { kind: 'sasflix'; title: string | null }
  | { kind: 'vk'; title: string | null };

type FeedItemProviderIdentity =
  | { provider: 'generic'; simpleImage: boolean }
  | { provider: 'hltv' }
  | { provider: 'instagram'; media: 'photo' | 'video' }
  | { provider: 'liquipedia' }
  | { provider: 'matreshka'; videoId: string }
  | { provider: 'onefootball'; simpleImage: boolean }
  | { provider: 'sasflix'; publicationId: string }
  | { provider: 'tiktok' }
  | { provider: 'twitch'; channel: string }
  | { provider: 'vk' }
  | { provider: 'youtube'; videoId: string };

export type FeedItemProvider = FeedItemProviderIdentity['provider'];

export type FeedItemProviderViewModel = FeedItemProviderIdentity & {
  url: URL | null;
  hostname: string | null;
  localPreview: FeedItemPreview | null;
};

export type FeedItemAnalyzer = (item: FeedItem) => FeedItemProviderViewModel;
