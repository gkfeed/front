import type { ServerResponse } from 'node:http';

import { isHltvMatchUrl, isOneFootballMatchUrl } from '../../shared/urlRules.js';
import { isTikTokPlaybackPreview, isTikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import { isYoutubeCommentsPreview, isYoutubeTimecodesPreview } from '../../shared/youtubeContracts.js';
import { isArticlePreview } from '../../shared/articleContracts.js';
import { sendJson } from './httpResponse.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import {
  createDetachedRequestExecutionContext,
  type RequestExecutionContext,
} from '../application/requestExecutionContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage, sendPreviewVideo } from './previewResponse.js';
import {
  bffRequestGate,
  createBffRequestGate,
  type BffRequestGate,
} from './bffRequestGate.js';
import { bffResultCache, type BffResultCache } from './bffResultCache.js';
import { suggestFeedType } from '../feedTypeSuggestion.js';

// HLS changes quality by overlapping playlist and byte-range requests. Keep
// these transfers isolated from metadata previews and allow that short burst.
const sasflixMediaRequestGate = createBffRequestGate({
  maxActive: 32,
  maxActivePerClient: 8,
  maxQueuedPerClient: 8,
  rateLimit: 600,
});
const CACHE_TTL_MS = {
  '/bff/feed-type': 5 * 60_000,
  '/bff/hltv-live': 0,
  '/bff/article': 5 * 60_000,
  '/bff/open-graph': 60_000,
  '/bff/liquipedia-match': 60_000,
  '/bff/tiktok-playback': 0, // Signed media URLs must not outlive the request.
  '/bff/tiktok-comments': 60_000,
  '/bff/youtube-comments': 60_000,
  '/bff/youtube-timecodes': 5 * 60_000,
  '/bff/reddit-preview-image': 5 * 60_000,
  '/bff/vk-video': 60_000, // Only the source lookup is cached; video bytes are streamed.
  '/bff/sasflix-media': 0, // Streamed responses cannot be shared or retained.
} as const;

function cacheTtlMs(pathname: string, input?: string): number {
  if (pathname === '/bff/open-graph' && input && isLiveMatchInput(input)) return 0;
  const ttlMs = CACHE_TTL_MS[pathname as keyof typeof CACHE_TTL_MS];
  if (ttlMs === undefined) throw new Error(`Missing BFF cache policy for ${pathname}`);
  return ttlMs;
}

type JsonPreviewUseCaseName = keyof Pick<PreviewUseCases, 'article' | 'openGraph' | 'liquipediaMatch' | 'tiktokPlayback' | 'tiktokComments' | 'youtubeComments' | 'youtubeTimecodes'>;

const JSON_PREVIEW_ROUTES: Record<string, JsonPreviewUseCaseName> = {
  '/bff/article': 'article',
  '/bff/open-graph': 'openGraph',
  '/bff/liquipedia-match': 'liquipediaMatch',
  '/bff/tiktok-playback': 'tiktokPlayback',
  '/bff/tiktok-comments': 'tiktokComments',
  '/bff/youtube-comments': 'youtubeComments',
  '/bff/youtube-timecodes': 'youtubeTimecodes',
};

export async function routeBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context: RequestExecutionContext | undefined,
  useCases: PreviewUseCases,
  clientId = 'detached',
  requestGate: BffRequestGate = bffRequestGate,
  resultCache: BffResultCache = bffResultCache,
  requestRange?: string,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestExecutionContext();
  if (requestUrl.pathname === '/bff/feed-type') {
    const input = getRequiredPreviewUrl(requestUrl);
    const title = requestUrl.searchParams.get('title')?.slice(0, 300);
    const result = await requestGate.run(clientId, requestContext, () => (
      resultCache.load(JSON.stringify([requestUrl.pathname, input, title ?? '']), (sharedContext) => (
        suggestFeedType({ url: input, ...(title ? { title } : {}) }, sharedContext)
      ), { context: requestContext, ttlMs: cacheTtlMs('/bff/feed-type') })
    ));
    sendJson(response, 200, result);
    return true;
  }
  if (requestUrl.pathname === '/bff/hltv-live') {
    const result = await requestGate.run(clientId, requestContext, () => (
      resultCache.load(requestUrl.pathname, (sharedContext) => useCases.hltvLiveIndex(sharedContext), {
        context: requestContext,
        ttlMs: cacheTtlMs('/bff/hltv-live'),
      })
    ));
    sendJson(response, 200, result);
    return true;
  }
  const useCaseName = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (useCaseName) {
    await handleJsonPreview(
      requestUrl,
      response,
      (input, context) => useCases[useCaseName](input, context),
      requestContext,
      clientId,
      requestGate,
      resultCache,
      cacheTtlMs(requestUrl.pathname, getRequiredPreviewUrl(requestUrl)),
      useCaseName === 'tiktokPlayback'
        ? isTikTokPlaybackPreview
        : useCaseName === 'tiktokComments'
        ? isTikTokCommentsPreview
        : useCaseName === 'youtubeComments'
          ? isYoutubeCommentsPreview
        : useCaseName === 'youtubeTimecodes'
          ? isYoutubeTimecodesPreview
        : useCaseName === 'article'
          ? isArticlePreview
          : undefined,
    );
    return true;
  }

  if (requestUrl.pathname === '/bff/reddit-preview-image') {
    const input = getRequiredPreviewUrl(requestUrl);
    const image = await requestGate.run(clientId, requestContext, () => (
      resultCache.load(`${requestUrl.pathname}:${input}`, (sharedContext) => (
        useCases.redditPreviewImage(input, sharedContext)
      ), { context: requestContext, ttlMs: cacheTtlMs('/bff/reddit-preview-image') })
    ));
    sendPreviewImage(response, image);
    return true;
  }

  if (requestUrl.pathname === '/bff/vk-video') {
    const input = getRequiredPreviewUrl(requestUrl);
    await requestGate.run(clientId, requestContext, async () => {
      const source = await resultCache.load(`${requestUrl.pathname}:${input}`, (sharedContext) => (
        useCases.vkVideoSource(input, sharedContext)
      ), { context: requestContext, ttlMs: cacheTtlMs('/bff/vk-video') });
      const video = await useCases.vkVideoStream(source, requestRange, requestContext);
      await sendPreviewVideo(response, video);
    });
    return true;
  }

  if (requestUrl.pathname === '/bff/sasflix-media') {
    const input = getRequiredPreviewUrl(requestUrl);
    await sasflixMediaRequestGate.run(clientId, requestContext, async () => {
      const media = await useCases.sasflixMedia(input, requestRange, requestContext);
      await sendPreviewVideo(response, media);
    });
    return true;
  }

  return false;
}

async function handleJsonPreview(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestExecutionContext) => Promise<unknown>,
  context: RequestExecutionContext,
  clientId: string,
  requestGate: BffRequestGate,
  resultCache: BffResultCache,
  ttlMs: number,
  validate?: (value: unknown) => boolean,
): Promise<void> {
  const input = getRequiredPreviewUrl(requestUrl);
  const result = await requestGate.run(clientId, context, () => (
    resultCache.load(`${requestUrl.pathname}:${input}`, (sharedContext) => load(input, sharedContext), {
      context,
      ttlMs,
    })
  ));
  if (validate && !validate(result)) throw new Error('Invalid preview contract');
  sendJson(response, 200, result);
}

function isLiveMatchInput(input: string): boolean {
  try {
    const url = new URL(input);
    return isHltvMatchUrl(url) || isOneFootballMatchUrl(url);
  } catch {
    return false;
  }
}
