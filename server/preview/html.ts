import { isIP } from 'node:net';

import { isPrivateAddress } from '../publicAddressPolicy.js';

const NAMED_ENTITIES: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };
const MAX_CODE_POINT = 0x10ffff;

export function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) attributes[name] = value;
  }
  return attributes;
}

export function decodeHtml(value: string): string {
  return value.replace(/&(#\d+|#x[\da-f]+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
    const number = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
    return Number.isSafeInteger(number) && number >= 0 && number <= MAX_CODE_POINT
      ? String.fromCodePoint(number)
      : entity;
  });
}

export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export function htmlText(value: string): string {
  return decodeHtml(stripTags(value)).replace(/\s+/g, ' ').trim();
}

export function resolveHttpUrl(value: string | null | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return isPublicSubresourceUrl(url) ? url.href : null;
  } catch {
    return null;
  }
}

function isPublicSubresourceUrl(url: URL): boolean {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isIP(hostname)) return !isPrivateAddress(hostname);

  // These names can resolve inside the reader's network without going through
  // public DNS. Single-label hosts are intranet names in browsers and OS
  // resolvers, so they are not safe remote subresources either.
  return hostname.includes('.')
    && hostname !== 'localhost'
    && !hostname.endsWith('.localhost')
    && !hostname.endsWith('.local')
    && hostname !== 'home.arpa'
    && !hostname.endsWith('.home.arpa');
}
