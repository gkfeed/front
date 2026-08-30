import { normalizeHostname } from '../../../shared/urlRules.js';
import { decodeHtml, parseAttributes, resolveHttpUrl } from '../html.js';

export function parseRezkaOriginalCover(html: string, pageUrl: URL): string | null {
  if (!['hdrezka.me', 'rezka.ag'].includes(normalizeHostname(pageUrl.hostname))) return null;
  const coverStart = html.match(
    /<[a-z][^>]*\bclass\s*=(?:"[^"]*\bb-sidecover\b[^"]*"|'[^']*\bb-sidecover\b[^']*'|[^\s>]*\bb-sidecover\b[^\s>]*)[^>]*>/i,
  );
  if (!coverStart || coverStart.index === undefined) return null;
  const coverMarkup = html.slice(coverStart.index, coverStart.index + 8_000);
  const linkTag = coverMarkup.match(/<a\b[^>]*>/i)?.[0];
  const imageTag = coverMarkup.match(/<img\b[^>]*>/i)?.[0];
  const linkAttributes = linkTag ? parseAttributes(linkTag) : null;
  const imageAttributes = imageTag ? parseAttributes(imageTag) : null;
  const source = linkAttributes?.href
    ?? imageAttributes?.['data-original']
    ?? imageAttributes?.['data-src']
    ?? imageAttributes?.src;
  return resolveHttpUrl(source ? decodeHtml(source) : null, pageUrl);
}
