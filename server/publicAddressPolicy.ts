import { isIP } from 'node:net';

/**
 * Returns true for addresses that must never be used by a public fetcher.
 *
 * This deliberately includes special-use and documentation ranges in
 * addition to RFC1918/private ranges. An address that is not globally
 * routable is not a safe destination for a server-side URL fetch.
 */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family !== 6) return true;

  const groups = parseIpv6(address);
  if (!groups) return true;

  // IPv4-mapped IPv6 addresses can be returned in compressed hexadecimal or
  // dotted-decimal form. Apply the IPv4 policy to the embedded address.
  const isMapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMapped) {
    const ipv4 = `${groups[6]! >> 8}.${groups[6]! & 0xff}.${groups[7]! >> 8}.${groups[7]! & 0xff}`;
    return isPrivateIpv4(ipv4);
  }

  const first = groups[0]!;
  return groups.slice(0, 6).every((group) => group === 0)
    || (first & 0xfe00) === 0xfc00 // unique local addresses, fc00::/7
    || (first & 0xffc0) === 0xfe80 // link-local addresses, fe80::/10
    || (first & 0xff00) === 0xff00 // multicast and ff00::/8
    || (first === 0x2001 && groups[1] === 0x0db8); // documentation, 2001:db8::/32
}

function isPrivateIpv4(address: string): boolean {
  const [a = 0, b = 0, c = 0] = address.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (
      (b === 0 && c === 0) // this host / protocol assignments
      || (b === 0 && c === 2) // TEST-NET-1
      || b === 168
    ))
    || (a === 198 && b >= 18 && b <= 19)
    || (a === 198 && b === 51 && c === 100) // TEST-NET-2
    || (a === 203 && b === 0 && c === 113) // TEST-NET-3
    || a >= 224;
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
