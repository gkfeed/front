import { createFeedUseCases } from '../features/feeds/feedUseCases';
import { createAuthUseCases } from '../features/auth/authUseCaseFactory';
import { createLiveUseCases } from '../features/live/liveUseCases';
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
import { isAuthenticationError } from '../services/authError';
import {
  EMPTY_REMOTE_PREVIEW,
  loadRemotePreview as loadRemotePreviewRequest,
  mergeHltvLiveData,
} from '../services/remotePreview';
import { getOpenGraphPreview } from '../services/openGraph';
import { fetchTikTokComments } from '../services/tiktokComments';
import { getLiveTwitchItems } from '../services/twitch';

export const featureUseCases = {
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
  live: createLiveUseCases({ getLiveTwitchItems }),
  preview: createPreviewUseCases({
    EMPTY_REMOTE_PREVIEW,
    fetchTikTokComments,
    getOpenGraphPreview,
    loadRemotePreview: loadRemotePreviewRequest,
    mergeHltvLiveData,
  }),
} as const;
