import { createFeedUseCases } from '../features/feeds/feedUseCases';
import { createAuthUseCases } from '../features/auth/authUseCaseFactory';
import type {
  LiveUseCases,
  PreviewUseCases,
} from '../features/featurePorts';
import {
  createFeed as createFeedRequest,
  createFeedFromUrl as createFeedFromUrlRequest,
  deleteFeedById,
  deleteFeedItemById,
  getAllFeeds,
  getFeedById,
  getFeedItems,
} from '../services/feeds';
import { validateCredentials } from '../services/auth';
import { isAuthenticationError } from '../services/authError';
import {
  EMPTY_REMOTE_PREVIEW,
  loadRemotePreview as loadRemotePreviewRequest,
  mergeHltvLiveData,
} from '../services/remotePreview';
import { getOpenGraphPreview } from '../services/openGraph';
import { getArticle } from '../services/article';
import { fetchTikTokComments } from '../services/tiktokComments';
import { getLiveTwitchItems } from '../services/twitch';

export function createFeatureComposition() {
  return {
    auth: createAuthUseCases({
      isAuthenticationError,
      validateCredentials: (credentials, signal) => signal === undefined
        ? validateCredentials(credentials)
        : validateCredentials(credentials, signal),
    }),
    feeds: createFeedUseCases({
      createFeed: createFeedRequest,
      createFeedFromUrl: createFeedFromUrlRequest,
      deleteFeedById,
      deleteFeedItemById,
      getAllFeeds,
      getFeedById,
      getFeedItems,
    }),
    live: {
      loadLiveTwitchItems: getLiveTwitchItems,
    } satisfies LiveUseCases,
    preview: {
      getArticle,
      EMPTY_REMOTE_PREVIEW,
      fetchTikTokComments,
      getOpenGraphPreview,
      loadRemotePreview: loadRemotePreviewRequest,
      mergeHltvLiveData,
    } satisfies PreviewUseCases,
  } as const;
}

export type FeatureUseCases = ReturnType<typeof createFeatureComposition>;
