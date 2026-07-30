import type { ServerResponse } from 'node:http';

import { sendJson } from './httpResponse.js';
import { PreviewError } from './preview/errors.js';
import { fetchLiquipediaMatch } from './preview/liquipedia.js';
import { fetchOpenGraph } from './preview/openGraph.js';
import { fetchRedditPreviewImage } from './preview/reddit.js';
import { withPreviewLimit } from './preview/previewLimiter.js';
import { fetchTikTokComments } from './tiktok.js';

const JSON_PREVIEW_ROUTES: Record<string, (input: string) => Promise<unknown>> = {
  '/api/bff/open-graph': fetchOpenGraph,
  '/api/bff/liquipedia-match': fetchLiquipediaMatch,
  '/api/bff/tiktok-comments': fetchTikTokComments,
};

export async function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
): Promise<boolean> {
  const jsonLoader = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (jsonLoader) {
    await handleJsonPreview(requestUrl, response, jsonLoader);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await withPreviewLimit(() => fetchRedditPreviewImage(getPreviewInput(requestUrl)));
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
  load: (input: string) => Promise<T>,
): Promise<void> {
  const result = await withPreviewLimit(() => load(getPreviewInput(requestUrl)));
  sendJson(response, 200, result);
}

function getPreviewInput(requestUrl: URL): string {
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) {
    throw new PreviewError('The url query parameter is required', 400, 'missing_url');
  }
  return targetUrl;
}
