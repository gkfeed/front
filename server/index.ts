import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchLiquipediaMatch,
  fetchOpenGraph,
  fetchRedditPreviewImage,
  PreviewError,
} from './opengraph.js';
import { fetchTikTokComments } from './tiktok.js';

const port = Number(process.env.PORT ?? 3000);
const staticRoot = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const MAX_ACTIVE_PREVIEWS = 32;
let activePreviews = 0;

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && requestUrl.pathname === '/api/bff/open-graph') {
      const targetUrl = requestUrl.searchParams.get('url');
      if (!targetUrl) throw new PreviewError('The url query parameter is required', 400, 'missing_url');
      sendJson(response, 200, await withPreviewLimit(() => fetchOpenGraph(targetUrl)));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/bff/liquipedia-match') {
      const targetUrl = requestUrl.searchParams.get('url');
      if (!targetUrl) throw new PreviewError('The url query parameter is required', 400, 'missing_url');
      sendJson(response, 200, await withPreviewLimit(() => fetchLiquipediaMatch(targetUrl)));
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/bff/reddit-preview-image') {
      const targetUrl = requestUrl.searchParams.get('url');
      if (!targetUrl) throw new PreviewError('The url query parameter is required', 400, 'missing_url');
      const image = await withPreviewLimit(() => fetchRedditPreviewImage(targetUrl));
      response.writeHead(200, {
        'cache-control': 'public, max-age=3600',
        'content-length': image.body.byteLength,
        'content-type': image.contentType,
        'x-content-type-options': 'nosniff',
      });
      response.end(image.body);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/bff/tiktok-comments') {
      const targetUrl = requestUrl.searchParams.get('url');
      if (!targetUrl) throw new PreviewError('The url query parameter is required', 400, 'missing_url');
      sendJson(response, 200, await withPreviewLimit(() => fetchTikTokComments(targetUrl)));
      return;
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed' } });
      return;
    }

    await serveFrontend(requestUrl.pathname, request.method === 'HEAD', response);
  } catch (error) {
    const previewError = error instanceof PreviewError
      ? error
      : new PreviewError('An unexpected error occurred', 500, 'internal_error');
    sendJson(response, previewError.status, {
      error: { code: previewError.code, message: previewError.message },
    });
  }
});

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

server.listen(port, '0.0.0.0', () => {
  console.log(`GKFeed BFF listening on http://0.0.0.0:${port}`);
});

async function serveFrontend(pathname: string, headOnly: boolean, response: ServerResponse): Promise<void> {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new PreviewError('Invalid path', 400, 'invalid_path');
  }

  const requestedFile = resolve(staticRoot, `.${decodedPath}`);
  const safeFile = requestedFile.startsWith(`${staticRoot}/`) ? requestedFile : resolve(staticRoot, 'index.html');
  const file = await isFile(safeFile) ? safeFile : resolve(staticRoot, 'index.html');
  const fileStat = await stat(file);

  response.writeHead(200, {
    'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'content-length': fileStat.size,
    'content-type': contentType(file),
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  });
  if (headOnly) response.end();
  else createReadStream(file).pipe(response);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(json),
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(json);
}

function contentType(file: string): string {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
  } as Record<string, string>)[extname(file)] ?? 'application/octet-stream';
}
