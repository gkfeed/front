import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import { isHltvMatchUrl, isVkImageHost } from '../../shared/urlRules.js';
import { decodeHtml, parseAttributes, resolveHttpUrl, stripTags } from './html.js';
import {
  parseHltvCompletedMaps,
  parseHltvCurrentMap,
  parseHltvMatchScore,
  parseHltvMatchStartsAt,
  parseHltvMatchStatus,
  parseHltvMatchTeams,
} from './hltvHtmlParser.js';
import { parseRezkaOriginalCover, parseVkStructuredVideo } from './openGraphProviderParsers.js';

export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  const isHltvMatch = isHltvMatchUrl(pageUrl);
  const matchStatus = isHltvMatch ? parseHltvMatchStatus(html) : null;
  const structuredVideo = parseVkStructuredVideo(html, pageUrl);
  const metadata = parseMetadata(html);
  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = parseRezkaOriginalCover(html, pageUrl) ?? firstMetadata(metadata, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]) ?? structuredVideo?.image ?? null;
  const video = firstMetadata(metadata, [
    'og:video:secure_url',
    'og:video',
    'og:video:url',
    'twitter:player:stream',
  ]) ?? structuredVideo?.embedUrl ?? null;

  return {
    url: pageUrl.href,
    title: firstMetadata(metadata, ['og:title', 'twitter:title'])
      ?? (documentTitle ? decodeHtml(stripTags(documentTitle).trim()) : null),
    description: firstMetadata(metadata, ['og:description', 'twitter:description', 'description']),
    image: resolvePreviewImageUrl(image, pageUrl),
    video: resolveHttpUrl(video, pageUrl),
    siteName: metadata.get('og:site_name') ?? null,
    type: metadata.get('og:type') ?? null,
    matchStartsAt: isHltvMatch ? parseHltvMatchStartsAt(html) : null,
    matchTeams: isHltvMatch ? parseHltvMatchTeams(html, pageUrl) : null,
    matchStatus,
    matchScore: matchStatus === 'live' || matchStatus === 'over' ? parseHltvMatchScore(html) : null,
    matchCurrentMap: matchStatus === 'live' ? parseHltvCurrentMap(html) : null,
    matchCompletedMaps: isHltvMatch ? parseHltvCompletedMaps(html) : null,
    matchPlayerStats: null,
    matchTeamSides: null,
  };
}

export { isHltvMatchUrl } from '../../shared/urlRules.js';

function parseMetadata(html: string): Map<string, string> {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = (attributes.content ?? attributes.value)?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }
  return metadata;
}

function resolvePreviewImageUrl(value: string | null | undefined, base: URL): string | null {
  const resolved = resolveHttpUrl(value, base);
  if (!resolved) return null;
  const url = new URL(resolved);
  if (url.protocol === 'http:' && isVkImageHost(url.hostname)) url.protocol = 'https:';
  return url.href;
}

function firstMetadata(metadata: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata.get(key);
    if (value) return value;
  }
  return null;
}
