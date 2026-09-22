import type { ServerResponse } from 'node:http';

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

// HLS changes quality by overlapping playlist and byte-range requests. Keep
// these transfers isolated from metadata previews and allow that short burst.
const sasflixMediaRequestGate = createBffRequestGate({
  maxActive: 32,
  maxActivePerClient: 8,
  maxQueuedPerClient: 8,
  rateLimit: 600,
});

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
  if (requestUrl.pathname === '/bff/hltv-live') {
    const result = await requestGate.run(clientId, requestContext, () => (
      resultCache.load(requestUrl.pathname, () => useCases.hltvLiveIndex(requestContext))
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
      resultCache.load(`${requestUrl.pathname}:${input}`, () => (
        useCases.redditPreviewImage(input, requestContext)
      ))
    ));
    sendPreviewImage(response, image);
    return true;
  }

  if (requestUrl.pathname === '/bff/vk-video') {
    const input = getRequiredPreviewUrl(requestUrl);
    await requestGate.run(clientId, requestContext, async () => {
      const source = await resultCache.load(`${requestUrl.pathname}:${input}`, () => (
        useCases.vkVideoSource(input, requestContext)
      ));
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
  validate?: (value: unknown) => boolean,
): Promise<void> {
  const input = getRequiredPreviewUrl(requestUrl);
  const result = await requestGate.run(clientId, context, () => (
    requestUrl.pathname === '/bff/tiktok-playback'
      ? load(input, context)
      : resultCache.load(`${requestUrl.pathname}:${input}`, () => load(input, context))
  ));
  if (validate && !validate(result)) throw new Error('Invalid preview contract');
  sendJson(response, 200, result);
}
