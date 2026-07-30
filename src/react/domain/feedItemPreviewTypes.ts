import type { FeedItem } from '../types';

export interface FeedItemPreview {
  src: string;
  alt: string;
  type?: 'video' | 'embed';
  poster?: string;
  fallbackSrc?: string;
}

export type FeedItemProvider =
  | 'generic'
  | 'hltv'
  | 'instagram'
  | 'liquipedia'
  | 'tiktok'
  | 'vk'
  | 'youtube';

export interface FeedItemAnalysis {
  url: URL | null;
  hostname: string;
  provider: FeedItemProvider;
  localPreview: FeedItemPreview | null;
  youtubeVideoId: string | null;
}

export type FeedItemAnalyzer = (item: FeedItem) => FeedItemAnalysis;
