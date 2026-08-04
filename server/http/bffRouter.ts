import type { ServerResponse } from 'node:http';

import { sendJson } from '../httpResponse.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import { createDetachedRequestContext, type RequestContext } from '../requestContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage } from './previewResponse.js';

type JsonPreviewHandler = (
  useCases: PreviewUseCases,
  input: string,
  context: RequestContext,
) => Promise<unknown>;

const JSON_PREVIEW_ROUTES: Record<string, JsonPreviewHandler> = {
  '/api/bff/open-graph': (useCases, input, context) => useCases.openGraph(input, context),
  '/api/bff/liquipedia-match': (useCases, input, context) => useCases.liquipediaMatch(input, context),
  '/api/bff/tiktok-comments': (useCases, input, context) => useCases.tiktokComments(input, context),
};

export async function routeBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context: RequestContext | undefined,
  useCases: PreviewUseCases,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestContext();
  const jsonPreviewHandler = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (jsonPreviewHandler) {
    await handleJsonPreview(
      requestUrl,
      response,
      (input, context) => jsonPreviewHandler(useCases, input, context),
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

async function handleJsonPreview<TResult>(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestContext) => Promise<TResult>,
  context: RequestContext,
): Promise<void> {
  const result = await load(getRequiredPreviewUrl(requestUrl), context);
  sendJson(response, 200, result);
}
