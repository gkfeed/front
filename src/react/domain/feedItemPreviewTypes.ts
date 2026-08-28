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

export type FeedItemProvider =
  | 'generic'
  | 'hltv'
  | 'instagram'
  | 'liquipedia'
  | 'matreshka'
  | 'sasflix'
  | 'tiktok'
  | 'twitch'
  | 'vk'
  | 'youtube';

export interface FeedItemAnalysis {
  url: URL | null;
  hostname: string | null;
  provider: FeedItemProvider;
  localPreview: FeedItemPreview | null;
  youtubeVideoId: string | null;
  twitchChannel: string | null;
  matreshkaVideoId: string | null;
  sasflixPublicationId: string | null;
}

export type FeedItemAnalyzer = (item: FeedItem) => FeedItemAnalysis;
