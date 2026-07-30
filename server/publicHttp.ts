import { lookup } from 'node:dns/promises';
import { request as requestHttp } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

const REQUEST_TIMEOUT_MS = 8_000;

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
      response.setTimeout(8_000, () => {
        response.destroy(new PublicHttpError('timeout'));
      });
      response.once('end', () => {
        clearTimeout(totalTimeout);
      });
      response.once('close', () => {
        clearTimeout(totalTimeout);
      });
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
    }, REQUEST_TIMEOUT_MS);
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new PublicHttpError('timeout'));
    });
    request.on('error', (error) => {
      clearTimeout(totalTimeout);
      reject(error instanceof PublicHttpError ? error : new PublicHttpError('network'));
    });
    request.end();
  });
}

export function createPinnedLookup(address: { address: string; family: 4 | 6 }): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
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
    return isPrivateIpv4(address);
  }

  if (isIP(address) !== 6) return true;

  const groups = parseIpv6(address);
  if (!groups) return true;

  // IPv4-mapped IPv6 addresses can be returned in compressed hexadecimal form,
  // e.g. ::ffff:7f00:1 for 127.0.0.1. Convert the final 32 bits before
  // applying the IPv4 private/reserved ranges.
  const isMapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMapped) {
    const ipv4 = `${groups[6]! >> 8}.${groups[6]! & 0xff}.${groups[7]! >> 8}.${groups[7]! & 0xff}`;
    return isPrivateIpv4(ipv4);
  }

  const first = groups[0]!;
  return groups.every((group) => group === 0)
    || groups.every((group, index) => group === (index === 7 ? 1 : 0))
    || (first & 0xfe00) === 0xfc00 // Unique local addresses (fc00::/7).
    || (first & 0xffc0) === 0xfe80 // Link-local addresses (fe80::/10).
    || (first & 0xff00) === 0xff00; // Multicast addresses (ff00::/8).
}

function isPrivateIpv4(address: string): boolean {
  const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && ((b === 0 && c === 0) || b === 168)) ||
    (a === 198 && b >= 18 && b <= 19) || a >= 224;
}

function parseIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  const halves = normalized.split('::');
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const parts = half.split(':');
    const last = parts.at(-1) ?? '';
    if (last.includes('.')) {
      if (isIP(last) !== 4 || parts.slice(0, -1).some((part) => !/^[\da-f]{1,4}$/i.test(part))) {
        return null;
      }
      const octets = last.split('.').map(Number);
      return [
        ...parts.slice(0, -1).map((part) => Number.parseInt(part, 16)),
        (octets[0]! << 8) | octets[1]!,
        (octets[2]! << 8) | octets[3]!,
      ];
    }
    if (parts.some((part) => !/^[\da-f]{1,4}$/i.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 16));
  };

  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  if (!left || !right) return null;
  if (halves.length === 1 && left.length !== 8) return null;
  if (halves.length === 2 && left.length + right.length >= 8) return null;

  return [
    ...left,
    ...Array.from({ length: 8 - left.length - right.length }, () => 0),
    ...right,
  ];
}
