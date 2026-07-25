import { lookup } from 'node:dns/promises';
import { request as requestHttp } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP } from 'node:net';

export interface PublicHttpResponse {
  body: IncomingMessage;
  headers: IncomingHttpHeaders;
  status: number;
  url: URL;
}

export class PublicHttpError extends Error {
  constructor(readonly reason: 'network' | 'private' | 'timeout' | 'unresolvable') {
    super(reason);
  }
}

export async function requestPublicHttp(
  input: URL,
  headers: Record<string, string>,
): Promise<PublicHttpResponse> {
  const address = await resolvePublicAddress(input);

  return new Promise((resolve, reject) => {
    const request = (input.protocol === 'https:' ? requestHttps : requestHttp)({
      protocol: input.protocol,
      hostname: input.hostname,
      port: input.port || undefined,
      path: `${input.pathname}${input.search}`,
      method: 'GET',
      headers,
      // Pin the connection to the address that passed validation. This prevents
      // a second DNS lookup from changing the destination between check and use.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    } satisfies RequestOptions, (response) => {
      response.setTimeout(8_000, () => {
        response.destroy(new PublicHttpError('timeout'));
      });
      resolve({
        body: response,
        headers: response.headers,
        status: response.statusCode ?? 0,
        url: input,
      });
    });

    request.setTimeout(8_000, () => {
      request.destroy(new PublicHttpError('timeout'));
    });
    request.on('error', (error) => {
      reject(error instanceof PublicHttpError ? error : new PublicHttpError('network'));
    });
    request.end();
  });
}

async function resolvePublicAddress(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolveHostname(hostname);

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new PublicHttpError('private');
  }

  const selected = addresses[0]!;
  return { address: selected.address, family: selected.family === 6 ? 6 : 4 };
}

async function resolveHostname(hostname: string) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PublicHttpError('unresolvable');
  }
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }

  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('ff') || /^fe[89ab]/.test(normalized);
}
