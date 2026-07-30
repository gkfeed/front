import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import { isVkImageHost } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { decodeHtml, parseAttributes, resolveHttpUrl, stripTags } from './html.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';
import { fetchLiquipediaMatch } from './liquipedia.js';
import { fetchRedditPreviewImage } from './reddit.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './remoteHttp.js';
import { fetchHltvHtml } from './hltvFetcher.js';
import {
  parseHltvMatchScore,
  parseHltvMatchStartsAt,
  parseHltvMatchStatus,
  parseHltvMatchTeams,
  parseHltvCompletedMaps,
  parseHltvCurrentMap,
} from './hltvParser.js';

export { parseLiquipediaMatch };
export { fetchLiquipediaMatch };
export { fetchRedditPreviewImage };
export { PreviewError };
export {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvParser.js';

const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';

export async function fetchOpenGraph(input: string): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  const url = getPreviewUrl(requestedUrl);
  const page: {
    html: string;
    url: URL;
    currentMap?: HltvCurrentMapPreview | null;
    playerStats?: HltvMatchPlayerStatsPreview | null;
    teamSides?: HltvMatchTeamSidesPreview | null;
  } = isHltvMatchUrl(url)
    ? await fetchHltvHtml(url)
    : await fetchHtml(
      url,
      isRezkaUrl(requestedUrl) ? REZKA_USER_AGENT : TWITTERBOT_USER_AGENT,
      { metadataOnly: isMatreshkaVideoUrl(requestedUrl) },
    );
  const preview = parseOpenGraph(page.html, page.url);
  if (page.currentMap) preview.matchCurrentMap = page.currentMap;
  if (page.playerStats) preview.matchPlayerStats = page.playerStats;
  if (page.teamSides) preview.matchTeamSides = page.teamSides;
  return preview;
}

function isHltvMatchUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'hltv.org'
    && /^\/matches\/\d+(?:\/|$)/.test(url.pathname);
}

function getPreviewUrl(url: URL): URL {
  if (!isRezkaUrl(url)) return url;
  const previewUrl = new URL(url.href);
  previewUrl.host = 'rezka.ag';
  return previewUrl;
}

function isRezkaUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'hdrezka.me';
}

function isMatreshkaVideoUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'matreshka.tv'
    && /^\/video\/[^/]+(?:\/|$)/i.test(url.pathname);
}

export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  const isHltvMatch = isHltvMatchUrl(pageUrl);
  const matchStatus = isHltvMatch ? parseHltvMatchStatus(html) : null;
  const structuredVideo = parseVkStructuredVideo(html, pageUrl);
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = (attributes.content ?? attributes.value)?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }

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

function parseVkStructuredVideo(
  html: string,
  pageUrl: URL,
): { embedUrl: string; image: string | null } | null {
  const hostname = pageUrl.hostname.toLowerCase().replace(/^www\./, '');
  if (!['vk.com', 'vk.ru'].includes(hostname)) return null;

  for (const match of html.matchAll(
    /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let data: unknown;
    try {
      data = JSON.parse(match[1] ?? '');
    } catch {
      continue;
    }

    const video = findStructuredVideo(data);
    if (!video) continue;
    const embedUrl = getObjectString(video, 'embedUrl');
    if (!embedUrl) continue;
    const resolvedEmbedUrl = resolveHttpUrl(embedUrl, pageUrl);
    if (!resolvedEmbedUrl || !isVkVideoEmbedUrl(resolvedEmbedUrl)) continue;
    const thumbnail = getObjectString(video, 'thumbnailUrl');
    return {
      embedUrl: resolvedEmbedUrl,
      image: resolveHttpUrl(thumbnail, pageUrl),
    };
  }
  return null;
}

function findStructuredVideo(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const video = findStructuredVideo(entry);
      if (video) return video;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  if (object['@type'] === 'VideoObject') return object;
  for (const key of ['video', '@graph']) {
    const video = findStructuredVideo(object[key]);
    if (video) return video;
  }
  return null;
}

function getObjectString(value: Record<string, unknown>, key: string): string | null {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property.trim() : null;
}

function isVkVideoEmbedUrl(value: string): boolean {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  return ['vk.com', 'vk.ru', 'vkvideo.ru'].includes(hostname)
    && /^\/(?:video|clip)_ext\.php$/i.test(url.pathname)
    && /^-?\d+$/.test(url.searchParams.get('oid') ?? '')
    && /^\d+$/.test(url.searchParams.get('id') ?? '');
}

function resolvePreviewImageUrl(value: string | null | undefined, base: URL): string | null {
  const resolved = resolveHttpUrl(value, base);
  if (!resolved) return null;
  const url = new URL(resolved);
  if (url.protocol === 'http:' && isVkImageHost(url.hostname)) url.protocol = 'https:';
  return url.href;
}

function parseRezkaOriginalCover(html: string, pageUrl: URL): string | null {
  if (pageUrl.hostname.toLowerCase().replace(/^www\./, '') !== 'rezka.ag') return null;
  const coverStart = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bb-sidecover\b[^"]*"|'[^']*\bb-sidecover\b[^']*')[^>]*>/i,
  );
  if (!coverStart || coverStart.index === undefined) return null;
  const coverMarkup = html.slice(coverStart.index, coverStart.index + 2_000);
  const linkTag = coverMarkup.match(/<a\b[^>]*>/i)?.[0];
  const href = linkTag ? parseAttributes(linkTag).href : null;
  return resolveHttpUrl(href ? decodeHtml(href) : null, pageUrl);
}

function firstMetadata(metadata: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata.get(key);
    if (value) return value;
  }
  return null;
}
