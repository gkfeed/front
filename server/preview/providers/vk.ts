import { normalizeHostname } from '../../../shared/urlRules.js';
import { isVkHost, isVkImageHost } from '../../../shared/urlRules.js';
import { getStringProperty, isRecord } from '../../../shared/valueGuards.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';
import { resolveHttpUrl } from '../html.js';

export const vkOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: (url) => isVkHost(url.hostname),
  async fetch(requestedUrl, context) {
    const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {}, context);
    return parseVkOpenGraph(page.html, page.url);
  },
  parse: parseVkOpenGraph,
};

function parseVkOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  const structuredVideo = parseVkStructuredVideo(html, pageUrl);
  return {
    ...preview,
    image: normalizeVkImage(preview.image ?? structuredVideo?.image ?? null),
    video: preview.video ?? structuredVideo?.embedUrl ?? null,
  };
}

function normalizeVkImage(value: string | null): string | null {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol === 'http:' && isVkImageHost(url.hostname)) url.protocol = 'https:';
  return url.href;
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

function findStructuredVideo(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const video = findStructuredVideo(entry);
      if (video) return video;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value['@type'] === 'VideoObject') return value;
  for (const key of ['video', '@graph']) {
    const video = findStructuredVideo(value[key]);
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
