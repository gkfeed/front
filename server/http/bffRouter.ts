import type { ServerResponse } from 'node:http';

import { sendJson } from '../httpResponse.js';
import type { PreviewUseCases } from '../application/previewPorts.js';
import { createDetachedRequestContext, type RequestContext } from '../requestContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage } from './previewResponse.js';

const JSON_PREVIEW_ROUTES: Record<string, keyof Pick<PreviewUseCases, 'openGraph' | 'liquipediaMatch' | 'tiktokComments'>> = {
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
    const load = useCases[useCaseName] as (input: string, context: RequestContext) => Promise<unknown>;
    await handleJsonPreview(requestUrl, response, load, requestContext);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await useCases.redditPreviewImage(getRequiredPreviewUrl(requestUrl), requestContext);
    sendPreviewImage(response, image);
    return true;
  }

  return false;
}

async function handleJsonPreview<TResult>(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestContext) => Promise<TResult>,
  context: RequestContext,
): Promise<void> {
  const result = await load(getRequiredPreviewUrl(requestUrl), context);
  sendJson(response, 200, result);
}
