import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../types';

export type FeedQueryPort = {
  getAllFeeds: (credentials: Credentials | null, signal?: AbortSignal) => Promise<Feed[]>;
  getFeedById: (
    id: number,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ) => Promise<Feed | undefined>;
};

export type FeedItemsPort = {
  getFeedItems: (
    credentials: Credentials | null,
    limit?: number,
    signal?: AbortSignal,
    onProgress?: (items: FeedItem[]) => boolean | void,
    initialPageSize?: number,
  ) => Promise<FeedItem[]>;
};

export type FeedCommandPort = {
  deleteFeedItemById: (id: number, credentials: Credentials | null) => Promise<void>;
  deleteFeedById: (id: number, credentials: Credentials | null) => Promise<void>;
  createFeed: (feed: FeedInput, credentials: Credentials | null) => Promise<void>;
  createFeedFromUrl: (feed: FeedLazyInput, credentials: Credentials | null) => Promise<void>;
};

export type FeedMetadataPort = {
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
};

export type FeedItemsCachePort = {
  read: (username: string, maxAgeMs: number) => Promise<FeedItem[] | undefined>;
  write: (username: string, items: FeedItem[]) => Promise<void>;
  delete: (username: string) => Promise<void>;
};

export type LiveApplicationPort = {
  getLiveTwitchItems: (
    credentials: Credentials | null,
    signal?: AbortSignal,
  ) => Promise<FeedItem[]>;
};

export type LiveUseCases = {
  loadLiveTwitchItems: LiveApplicationPort['getLiveTwitchItems'];
};

export type AuthApplicationPort = {
  validateCredentials: (credentials: Credentials, signal?: AbortSignal) => Promise<void>;
  isAuthenticationError: (error: unknown) => boolean;
};

export type { TikTokComment, TikTokCommentsPreview } from '../../../shared/tiktokContracts';
