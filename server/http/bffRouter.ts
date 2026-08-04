import type { ServerResponse } from 'node:http';

import { sendJson } from './httpResponse.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import { createDetachedRequestContext, type RequestContext } from '../requestContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage } from './previewResponse.js';

type JsonPreviewUseCaseName = keyof Pick<PreviewUseCases, 'openGraph' | 'liquipediaMatch' | 'tiktokComments'>;

const JSON_PREVIEW_ROUTES: Record<string, JsonPreviewUseCaseName> = {
  '/api/bff/open-graph': 'openGraph',
  '/api/bff/liquipedia-match': 'liquipediaMatch',
  '/api/bff/tiktok-comments': 'tiktokComments',
};

export async function routeBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context: RequestContext | undefined,
  useCases: PreviewUseCases,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestContext();
  const useCaseName = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (useCaseName) {
    await handleJsonPreview(
      requestUrl,
      response,
      (input, context) => useCases[useCaseName](input, context),
      requestContext,
    );
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await useCases.redditPreviewImage(getRequiredPreviewUrl(requestUrl), requestContext);
    sendPreviewImage(response, image);
    return true;
  }

  return false;
}

async function handleJsonPreview(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestContext) => Promise<unknown>,
  context: RequestContext,
): Promise<void> {
  const result = await load(getRequiredPreviewUrl(requestUrl), context);
  sendJson(response, 200, result);
}
