import { request as requestHttp } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { Agent as HttpsAgent, request as requestHttps } from 'node:https';

import { createPinnedLookup, resolvePublicAddress } from './publicAddress.js';
import { PublicHttpError } from './publicHttpError.js';
import { REMOTE_REQUEST_TIMEOUT_MS } from './timeouts.js';
import {
  createDetachedRequestExecutionContext,
  isRequestDeadlineExceeded,
  type RequestExecutionContext,
} from './application/requestExecutionContext.js';

export { PublicHttpError } from './publicHttpError.js';
export { createPinnedLookup, isPrivateAddress, resolvePublicAddress } from './publicAddress.js';

export function createPinnedHttpsAgent(
  address: { address: string; family: 4 | 6 },
): HttpsAgent {
  return new HttpsAgent({ lookup: createPinnedLookup(address) });
}

export interface PublicHttpResponse {
  body: IncomingMessage;
  headers: IncomingHttpHeaders;
  status: number;
  url: URL;
}

export async function requestPublicHttp(
  input: URL,
  headers: Record<string, string>,
  context?: RequestExecutionContext,
  options: { method?: 'GET' | 'POST'; body?: string } = {},
): Promise<PublicHttpResponse> {
  const requestContext = context ?? createDetachedRequestExecutionContext();
  const address = await resolvePublicAddress(input, requestContext);
  const timeoutMs = requestContext.remainingMs(REMOTE_REQUEST_TIMEOUT_MS);
  if (timeoutMs <= 0 || requestContext.signal.aborted) {
    throw new PublicHttpError(isRequestDeadlineExceeded(requestContext) ? 'timeout' : 'aborted');
  }

  return new Promise((resolve, reject) => {
    let responseBody: IncomingMessage | undefined;
    let settled = false;
    const request = (input.protocol === 'https:' ? requestHttps : requestHttp)({
      protocol: input.protocol,
      hostname: input.hostname,
      port: input.port || undefined,
      path: `${input.pathname}${input.search}`,
      method: options.method ?? 'GET',
      headers,
      // Pin the connection to the address that passed validation. This prevents
      // a second DNS lookup from changing the destination between check and use.
      lookup: createPinnedLookup(address),
    } satisfies RequestOptions, (response) => {
      responseBody = response;
      response.setTimeout(REMOTE_REQUEST_TIMEOUT_MS, () => {
        response.destroy(new PublicHttpError('timeout'));
      });
      response.once('end', clearTotalTimeout);
      response.once('close', clearTotalTimeout);
      requestContext.signal.addEventListener('abort', abortRequest, { once: true });
      if (requestContext.signal.aborted) abortRequest();
      settled = true;
      resolve({
        body: response,
        headers: response.headers,
        status: response.statusCode ?? 0,
        url: input,
      });
    });

    const totalTimeout = setTimeout(() => {
      const error = new PublicHttpError('timeout');
      request.destroy(error);
      responseBody?.destroy(error);
    }, timeoutMs);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new PublicHttpError('timeout'));
    });
    requestContext.signal.addEventListener('abort', abortRequest, { once: true });
    request.on('error', (error) => {
      clearTimeout(totalTimeout);
      requestContext.signal.removeEventListener('abort', abortRequest);
      if (settled) return;
      reject(error instanceof PublicHttpError ? error : new PublicHttpError('network'));
    });
    request.end(options.body);

    function clearTotalTimeout() {
      clearTimeout(totalTimeout);
      requestContext.signal.removeEventListener('abort', abortRequest);
    }

    function abortRequest() {
      const error = new PublicHttpError(isRequestDeadlineExceeded(requestContext) ? 'timeout' : 'aborted');
      request.destroy(error);
      responseBody?.destroy(error);
    }
  });
}

export function discardResponseBody(body: IncomingMessage): void {
  body.destroy();
}
