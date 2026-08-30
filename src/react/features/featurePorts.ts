import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type { TikTokCommentsPreview } from '../../../shared/tiktokContracts';
import type { ArticlePreview } from '../../../shared/articleContracts';

import type { RemotePreview } from '../domain/feedItemCardContracts';
import type { Credentials, Feed, FeedInput, FeedItem, FeedLazyInput } from '../types';

export type FeedApplicationPort = {
  getAllFeeds: (credentials: Credentials | null, signal?: AbortSignal) => Promise<Feed[]>;
  getFeedById: (
    id: number,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ) => Promise<Feed | undefined>;
  getFeedItems: (
    credentials: Credentials | null,
    limit?: number,
    signal?: AbortSignal,
    onProgress?: (items: FeedItem[]) => boolean | void,
    initialPageSize?: number,
  ) => Promise<FeedItem[]>;
  deleteFeedItemById: (id: number, credentials: Credentials | null) => Promise<void>;
  deleteFeedById: (id: number, credentials: Credentials | null) => Promise<void>;
  createFeed: (feed: FeedInput, credentials: Credentials | null) => Promise<void>;
  createFeedFromUrl: (feed: FeedLazyInput, credentials: Credentials | null) => Promise<void>;
};

export type FeedMetadataPort = {
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
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

export type PreviewApplicationPort = {
  getArticle: (url: string, signal?: AbortSignal) => Promise<ArticlePreview>;
  EMPTY_REMOTE_PREVIEW: RemotePreview;
  loadRemotePreview: (
    url: string,
    isLiquipedia: boolean,
    signal: AbortSignal,
  ) => Promise<RemotePreview>;
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
  fetchTikTokComments: (url: string, signal: AbortSignal) => Promise<TikTokCommentsPreview>;
  mergeHltvLiveData: (
    next: OpenGraphPreview,
    previous: OpenGraphPreview | null,
  ) => OpenGraphPreview;
};

export type PreviewUseCases = PreviewApplicationPort;

export type { TikTokComment, TikTokCommentsPreview } from '../../../shared/tiktokContracts';
