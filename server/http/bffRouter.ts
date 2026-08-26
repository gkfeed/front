import type { ServerResponse } from 'node:http';

import { isTikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import { isArticlePreview } from '../../shared/articleContracts.js';
import { sendJson } from './httpResponse.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import {
  createDetachedRequestExecutionContext,
  type RequestExecutionContext,
} from '../application/requestExecutionContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage, sendPreviewRedirect } from './previewResponse.js';
import { bffRequestGate, type BffRequestGate } from './bffRequestGate.js';
import { bffResultCache, type BffResultCache } from './bffResultCache.js';

type JsonPreviewUseCaseName = keyof Pick<PreviewUseCases, 'article' | 'openGraph' | 'liquipediaMatch' | 'tiktokComments'>;

const JSON_PREVIEW_ROUTES: Record<string, JsonPreviewUseCaseName> = {
  '/bff/article': 'article',
  '/bff/open-graph': 'openGraph',
  '/bff/liquipedia-match': 'liquipediaMatch',
  '/bff/tiktok-comments': 'tiktokComments',
};

export async function routeBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context: RequestExecutionContext | undefined,
  useCases: PreviewUseCases,
  clientId = 'detached',
  requestGate: BffRequestGate = bffRequestGate,
  resultCache: BffResultCache = bffResultCache,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestExecutionContext();
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
      useCaseName === 'tiktokComments'
        ? isTikTokCommentsPreview
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

  if (requestUrl.pathname === '/bff/tiktok-video') {
    const input = getRequiredPreviewUrl(requestUrl);
    const redirect = await requestGate.run(clientId, requestContext, () => (
      resultCache.load(`${requestUrl.pathname}:${input}`, () => (
        useCases.tiktokVideo(input, requestContext)
      ))
    ));
    sendPreviewRedirect(response, redirect);
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
    resultCache.load(`${requestUrl.pathname}:${input}`, () => load(input, context))
  ));
  if (validate && !validate(result)) throw new Error('Invalid preview contract');
  sendJson(response, 200, result);
}
