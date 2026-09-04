import { createFeedUseCases } from '../features/feeds/feedUseCases';
import { createAuthUseCases } from '../features/auth/authUseCaseFactory';
import type { LiveUseCases } from '../features/featurePorts';
import { createPreviewUseCases } from '../features/preview/previewUseCases';
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
import { isAuthenticationError } from '../domain/requestError';
import { loadRemotePreview as loadRemotePreviewRequest } from '../services/remotePreview';
import { getOpenGraphPreview } from '../services/openGraph';
import { getArticle } from '../services/article';
import { fetchTikTokComments } from '../services/tiktokComments';
import { fetchYoutubeComments } from '../services/youtubeComments';
import { getLiveTwitchItems } from '../services/twitch';
import {
  deleteFeedItemsCache,
  readFeedItemsCache,
  writeFeedItemsCache,
} from '../services/feedItemsCache';

export function createFeatureComposition() {
  return {
    auth: createAuthUseCases({
      isAuthenticationError,
      validateCredentials: (credentials, signal) => signal === undefined
        ? validateCredentials(credentials)
        : validateCredentials(credentials, signal),
    }),
    feeds: createFeedUseCases({
      queryPort: {
        getAllFeeds,
        getFeedById,
      },
      itemsPort: {
        getFeedItems,
      },
      commandPort: {
        createFeed: createFeedRequest,
        createFeedFromUrl: createFeedFromUrlRequest,
        deleteFeedById,
        deleteFeedItemById,
      },
      metadataPort: { getOpenGraphPreview },
      cachePort: {
        read: readFeedItemsCache,
        write: writeFeedItemsCache,
        delete: deleteFeedItemsCache,
      },
    }),
    live: {
      loadLiveTwitchItems: getLiveTwitchItems,
    } satisfies LiveUseCases,
    preview: createPreviewUseCases({
      getArticle,
      fetchTikTokComments,
      fetchYoutubeComments,
      getOpenGraphPreview,
      loadRemotePreview: loadRemotePreviewRequest,
    }),
  } as const;
}

export type FeatureUseCases = ReturnType<typeof createFeatureComposition>;
