import { decodeHtml, parseAttributes, resolveHttpUrl } from './html.js';
import { normalizeHostname } from '../../shared/urlRules.js';
import { getStringProperty, isRecord } from '../../shared/valueGuards.js';

export function parseInstagramEmbedMedia(
  html: string,
): { type: 'video' | 'photo'; videoUrl: string | null; imageUrl: string | null } | null {
  const normalized = html.replace(/\\"/g, '"');
  const mediaIndex = findInstagramMediaIndex(normalized);
  if (mediaIndex < 0) return null;

  const mediaData = normalized.slice(mediaIndex);
  const encodedImageUrl = mediaData.match(
    /"display_url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
  )?.[1];
  const imageUrl = decodeInstagramMediaUrl(encodedImageUrl);
  const videoVersions = mediaData.match(/"video_versions"\s*:\s*\[([\s\S]*?)\]/i)?.[1];
  if (
    /"is_video"\s*:\s*true/i.test(mediaData)
    || /"media_type"\s*:\s*2(?:\D|$)/i.test(mediaData)
    || videoVersions
  ) {
    const encodedVideoUrl = mediaData.match(
      /"video_url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    )?.[1] ?? videoVersions?.match(
      /"url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    )?.[1];
    return {
      type: 'video',
      videoUrl: decodeInstagramMediaUrl(encodedVideoUrl),
      imageUrl,
    };
  }
  if (/"is_video"\s*:\s*false/i.test(mediaData)) {
    return { type: 'photo', videoUrl: null, imageUrl };
  }
  return null;
}

function findInstagramMediaIndex(html: string): number {
  for (const marker of [
    '"shortcode_media"',
    '"xdt_api__v1__media__shortcode__web_info"',
    '"video_versions"',
  ]) {
    const index = html.indexOf(marker);
    if (index >= 0) return index;
  }
  return -1;
}

function decodeInstagramMediaUrl(value: string | undefined): string | null {
  if (!value) return null;

  let decoded: unknown;
  try {
    const normalizedEscapes = value.replace(/\\{2,}(?=[/u])/g, '\\');
    decoded = JSON.parse(`"${normalizedEscapes}"`);
  } catch {
    return null;
  }
  if (typeof decoded !== 'string') return null;
  const decodedUrl = decodeHtml(decoded);

  let url: URL;
  try {
    url = new URL(decodedUrl);
  } catch {
    return null;
  }
  return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}

export function parseVkStructuredVideo(
  html: string,
  pageUrl: URL,
): { embedUrl: string; image: string | null } | null {
  const hostname = normalizeHostname(pageUrl.hostname);
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

export function parseSasflixVideoUrl(html: string, pageUrl: URL): string | null {
  if (
    normalizeHostname(pageUrl.hostname) !== 'sasflix.ru'
    || pageUrl.protocol !== 'https:'
    || pageUrl.username
    || pageUrl.password
    || pageUrl.port
    || !/^\/[a-z0-9_-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(pageUrl.pathname)
  ) return null;

  const videoId = html.match(
    /(?:https:\\u002F\\u002Fsasflix\.ru\\u002F|https:\/\/sasflix\.ru\/|\/)?api\/poster\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[/?"'\\]|$)/i,
  )?.[1];
  return videoId ? `https://sasflix.ru/api/video/${videoId}.m3u8` : null;
}

export function parseMatreshkaVideoUrl(html: string, pageUrl: URL): string | null {
  if (
    normalizeHostname(pageUrl.hostname) !== 'matreshka.tv'
    || !/^\/(?:video|embed\/video)\/[A-Za-z0-9_-]{1,64}\/?$/i.test(pageUrl.pathname)
  ) return null;

  const normalized = html
    .replace(/\\u003A/gi, ':')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/');
  const streams = Array.from(normalized.matchAll(
    /"(\d{3,4})"\s*:\s*"(https:\/\/[^"\\]+\/master\.m3u8\?[^"\\]+)"/gi,
  )).map((match) => ({
    height: Number(match[1]),
    url: validateMatreshkaVideoUrl(decodeHtml(match[2]!)),
  })).filter((stream): stream is { height: number; url: string } => Boolean(stream.url));

  streams.sort((first, second) => second.height - first.height);
  return streams[0]?.url ?? null;
}

function validateMatreshkaVideoUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'https:'
    && /^c\d+-video\.cmtv\.ru$/i.test(url.hostname)
    && /^\/hm\/[A-Za-z0-9_-]+\/[A-Za-z0-9+/=_-]+\/master\.m3u8$/i.test(url.pathname)
    && url.searchParams.has('expires')
    && url.searchParams.has('md5')
    ? url.href
    : null;
}

function findStructuredVideo(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const video = findStructuredVideo(entry);
      if (video) return video;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const object = value;
  if (object['@type'] === 'VideoObject') return object;
  for (const key of ['video', '@graph']) {
    const video = findStructuredVideo(object[key]);
    if (video) return video;
  }
  return null;
}

function getObjectString(value: Record<string, unknown>, key: string): string | null {
  const property = getStringProperty(value, key);
  return property?.trim() || null;
}

function isVkVideoEmbedUrl(value: string): boolean {
  const url = new URL(value);
  const hostname = normalizeHostname(url.hostname);
  return ['vk.com', 'vk.ru', 'vkvideo.ru'].includes(hostname)
    && /^\/(?:video|clip)_ext\.php$/i.test(url.pathname)
    && /^-?\d+$/.test(url.searchParams.get('oid') ?? '')
    && /^\d+$/.test(url.searchParams.get('id') ?? '');
}
