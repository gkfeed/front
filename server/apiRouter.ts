import type { ServerResponse } from 'node:http';

import { previewUseCases, type PreviewUseCases } from './application/previewUseCases.js';
import { sendJson } from './httpResponse.js';
import { PreviewError } from './preview/errors.js';
import { createDetachedRequestContext, type RequestContext } from './requestContext.js';

const JSON_PREVIEW_ROUTES: Record<string, keyof Pick<PreviewUseCases, 'openGraph' | 'liquipediaMatch' | 'tiktokComments'>> = {
  '/api/bff/open-graph': 'openGraph',
  '/api/bff/liquipedia-match': 'liquipediaMatch',
  '/api/bff/tiktok-comments': 'tiktokComments',
};

export async function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context?: RequestContext,
  useCases: PreviewUseCases = previewUseCases,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestContext();
  const useCaseName = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (useCaseName) {
    await handleJsonPreview(requestUrl, response, useCases[useCaseName], requestContext);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await useCases.redditPreviewImage(getPreviewInput(requestUrl), requestContext);
    response.writeHead(200, {
      'cache-control': 'public, max-age=3600',
      'content-length': image.body.byteLength,
      'content-type': image.contentType,
      'x-content-type-options': 'nosniff',
    });
    response.end(image.body);
    return true;
  }

  return false;
}

async function handleJsonPreview<T>(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestContext) => Promise<T>,
  context: RequestContext,
): Promise<void> {
  const result = await load(getPreviewInput(requestUrl), context);
  sendJson(response, 200, result);
}

function getPreviewInput(requestUrl: URL): string {
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) {
    throw new PreviewError('The url query parameter is required', 400, 'missing_url');
  }
  return targetUrl;
}
