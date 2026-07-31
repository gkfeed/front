import { request as requestHttp } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { Agent as HttpsAgent, request as requestHttps } from 'node:https';

import { createPinnedLookup, resolvePublicAddress } from './publicAddress.js';
import { PublicHttpError } from './publicHttpError.js';
import { REMOTE_REQUEST_TIMEOUT_MS } from './timeouts.js';

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
): Promise<PublicHttpResponse> {
  const address = await resolvePublicAddress(input);

  return new Promise((resolve, reject) => {
    let responseBody: IncomingMessage | undefined;
    const request = (input.protocol === 'https:' ? requestHttps : requestHttp)({
      protocol: input.protocol,
      hostname: input.hostname,
      port: input.port || undefined,
      path: `${input.pathname}${input.search}`,
      method: 'GET',
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
    }, REMOTE_REQUEST_TIMEOUT_MS);
    request.setTimeout(REMOTE_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new PublicHttpError('timeout'));
    });
    request.on('error', (error) => {
      clearTimeout(totalTimeout);
      reject(error instanceof PublicHttpError ? error : new PublicHttpError('network'));
    });
    request.end();

    function clearTotalTimeout() {
      clearTimeout(totalTimeout);
    }
  });
}
