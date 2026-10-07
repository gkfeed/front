import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type { FeedTypeSuggestion } from '../../../shared/feedTypeSuggestion';
import type { YoutubeChannelResolution } from '../../../shared/youtubeChannel';
import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../types';
import type { ItemSnapshot, ItemChangesPage, CachedFeedItems } from '../domain/itemSync';

export type FeedQueryPort = {
  getAllFeeds: (credentials: Credentials | null, signal?: AbortSignal) => Promise<Feed[]>;
  getFeedById: (
    id: number,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ) => Promise<Feed | undefined>;
};

export type FeedItemsPort = {
  syncFeedItems: (
    credentials: Credentials | null,
    signal?: AbortSignal,
    onProgress?: (items: FeedItem[]) => boolean | void,
    initialPageSize?: number,
  ) => Promise<ItemSnapshot>;
  getFeedItemChanges: (
    credentials: Credentials | null,
    cursor: string,
    signal?: AbortSignal,
  ) => Promise<ItemChangesPage>;
};

export type FeedCommandPort = {
  deleteFeedItemById: (id: number, credentials: Credentials | null) => Promise<void>;
  deleteFeedById: (id: number, credentials: Credentials | null) => Promise<void>;
  createFeed: (feed: FeedInput, credentials: Credentials | null) => Promise<void>;
  createFeedFromUrl: (feed: FeedLazyInput, credentials: Credentials | null) => Promise<void>;
};

export type FeedMetadataPort = {
  resolveYoutubeChannel: (url: string, signal?: AbortSignal) => Promise<YoutubeChannelResolution>;
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
  getFeedTypeSuggestion: (
    url: string,
    title: string,
    signal?: AbortSignal,
  ) => Promise<FeedTypeSuggestion>;
};

export type FeedItemsCachePort = {
  read: (username: string) => Promise<CachedFeedItems | undefined>;
  write: (username: string, snapshot: ItemSnapshot) => Promise<void>;
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
