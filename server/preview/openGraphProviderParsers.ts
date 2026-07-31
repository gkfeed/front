import { decodeHtml, parseAttributes, resolveHttpUrl } from './html.js';
import { normalizeHostname } from '../../shared/urlRules.js';
import { getStringProperty, isRecord } from '../../shared/valueGuards.js';

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
  if (normalizeHostname(pageUrl.hostname) !== 'rezka.ag') return null;
  const coverStart = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bb-sidecover\b[^"]*"|'[^']*\bb-sidecover\b[^']*')[^>]*>/i,
  );
  if (!coverStart || coverStart.index === undefined) return null;
  const coverMarkup = html.slice(coverStart.index, coverStart.index + 2_000);
  const linkTag = coverMarkup.match(/<a\b[^>]*>/i)?.[0];
  const href = linkTag ? parseAttributes(linkTag).href : null;
  return resolveHttpUrl(href ? decodeHtml(href) : null, pageUrl);
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
