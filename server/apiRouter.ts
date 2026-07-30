import type { ServerResponse } from 'node:http';

import { sendJson } from './httpResponse.js';
import { PreviewError } from './preview/errors.js';
import { fetchLiquipediaMatch } from './preview/liquipedia.js';
import { fetchOpenGraph } from './preview/openGraph.js';
import { fetchRedditPreviewImage } from './preview/reddit.js';
import { fetchTikTokComments } from './tiktok.js';

const MAX_ACTIVE_PREVIEWS = 32;
let activePreviews = 0;

export async function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
): Promise<boolean> {
  if (requestUrl.pathname === '/api/bff/open-graph') {
    await handleJsonPreview(requestUrl, response, fetchOpenGraph);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/liquipedia-match') {
    await handleJsonPreview(requestUrl, response, fetchLiquipediaMatch);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await withPreviewLimit(() => getPreviewInput(requestUrl).then(fetchRedditPreviewImage));
    response.writeHead(200, {
      'cache-control': 'public, max-age=3600',
      'content-length': image.body.byteLength,
      'content-type': image.contentType,
      'x-content-type-options': 'nosniff',
    });
    response.end(image.body);
    return true;
  }

  if (requestUrl.pathname === '/api/bff/tiktok-comments') {
    await handleJsonPreview(requestUrl, response, fetchTikTokComments);
    return true;
  }

  return false;
}

async function handleJsonPreview<T>(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string) => Promise<T>,
): Promise<void> {
  const result = await withPreviewLimit(() => getPreviewInput(requestUrl).then(load));
  sendJson(response, 200, result);
}

function getPreviewInput(requestUrl: URL): Promise<string> {
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) return Promise.reject(new PreviewError(
    'The url query parameter is required',
    400,
    'missing_url',
  ));
  return Promise.resolve(targetUrl);
}

async function withPreviewLimit<T>(load: () => Promise<T>): Promise<T> {
  if (activePreviews >= MAX_ACTIVE_PREVIEWS) {
    throw new PreviewError('Too many preview requests are in progress', 429, 'preview_busy');
  }

  activePreviews += 1;
  try {
    return await load();
  } finally {
    activePreviews -= 1;
  }
}
