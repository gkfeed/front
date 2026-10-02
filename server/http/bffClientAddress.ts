import type { IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';

export function createBffClientAddressResolver(trustedProxyCidrs = '') {
  const trustedProxies = new BlockList();
  for (const entry of trustedProxyCidrs.split(',')) {
    const value = entry.trim();
    if (!value) continue;
    const [address, prefix, extra] = value.split('/');
    const family = isIP(address);
    const maximumPrefix = family === 4 ? 32 : 128;
    if (extra || !family || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > maximumPrefix))) {
      throw new Error(`Invalid BFF_TRUSTED_PROXY_CIDRS entry: ${value}`);
    }
    trustedProxies.addSubnet(address, prefix === undefined ? maximumPrefix : Number(prefix), family === 4 ? 'ipv4' : 'ipv6');
  }

  const isTrusted = (address: string) => trustedProxies.check(address, isIP(address) === 4 ? 'ipv4' : 'ipv6');

  return (request: IncomingMessage): string => {
    const peer = normalizeAddress(request.socket.remoteAddress);
    if (!peer) return 'unknown';
    if (!isTrusted(peer)) return peer;

    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded !== 'string') return peer;
    const hops = forwarded.split(',').map((value) => normalizeAddress(value.trim()));

    for (let index = hops.length - 1; index >= 0; index -= 1) {
      const hop = hops[index];
      if (!hop) return peer;
      if (!isTrusted(hop)) return hop;
    }
    return hops[0]!;
  };
}

function normalizeAddress(value: string | undefined): string | null {
  if (!value) return null;
  const dottedMapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value);
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(value);
  const address = dottedMapped
    ? dottedMapped[1]!
    : hexMapped
      ? [Number.parseInt(hexMapped[1]!, 16), Number.parseInt(hexMapped[2]!, 16)]
        .flatMap((part) => [part >> 8, part & 0xff]).join('.')
      : value;
  return isIP(address) ? address.toLowerCase() : null;
}
