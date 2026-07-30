import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

import { PublicHttpError } from './publicHttpError.js';

export async function resolvePublicAddress(url: URL): Promise<{ address: string; family: 4 | 6 }> {
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

export function createPinnedLookup(address: { address: string; family: 4 | 6 }): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address);

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
    || (first & 0xfe00) === 0xfc00
    || (first & 0xffc0) === 0xfe80
    || (first & 0xff00) === 0xff00;
}

async function resolveHostname(hostname: string) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PublicHttpError('unresolvable');
  }
}

function isPrivateIpv4(address: string): boolean {
  const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && ((b === 0 && c === 0) || b === 168))
    || (a === 198 && b >= 18 && b <= 19) || a >= 224;
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
