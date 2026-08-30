import { request as requestHttp } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { request as requestHttps } from 'node:https';
import { pipeline } from 'node:stream/promises';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

const DEFAULT_API_ORIGIN = new URL('https://feed.gws.freemyip.com');
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function createApiProxy(apiOrigin = DEFAULT_API_ORIGIN) {
  return async function proxyApiRequest(
    request: IncomingMessage,
    requestUrl: URL,
    response: ServerResponse,
    context: RequestExecutionContext,
  ): Promise<boolean> {
    if (!requestUrl.pathname.startsWith('/api/v1/')) return false;

    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, apiOrigin);
    const transport = upstreamUrl.protocol === 'https:' ? requestHttps : requestHttp;

    await new Promise<void>((resolve, reject) => {
      const upstreamRequest = transport(upstreamUrl, {
        method: request.method,
        headers: forwardRequestHeaders(request.headers),
        signal: context.signal,
      }, (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          upstreamResponse.statusMessage,
          forwardResponseHeaders(upstreamResponse.headers),
        );
        void pipeline(upstreamResponse, response).then(resolve, reject);
      });
      upstreamRequest.once('error', reject);
      request.pipe(upstreamRequest);
    });

    return true;
  };
}

function forwardRequestHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const forwarded: Record<string, string | string[]> = {};
  for (const name of ['accept', 'accept-language', 'authorization', 'content-type', 'user-agent']) {
    const value = headers[name];
    if (value !== undefined) forwarded[name] = value;
  }
  return forwarded;
}

function forwardResponseHeaders(headers: IncomingHttpHeaders): Record<string, string | string[]> {
  const forwarded: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !HOP_BY_HOP_HEADERS.has(name)) forwarded[name] = value;
  }
  return forwarded;
}
