import { normalizeHostname } from '../../../shared/urlRules.js';
import { isVkHost, isVkImageHost } from '../../../shared/urlRules.js';
import { parseHTML } from 'linkedom';
import { getStringProperty, isRecord } from '../../../shared/valueGuards.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchVkHtml } from '../vkFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { decodeHtml, parseAttributes, resolveHttpUrl } from '../html.js';
import { isVkMissingWallPage } from '../vkPageState.js';

export const vkOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: (url) => isVkHost(url.hostname),
  async fetch(requestedUrl, context) {
    const page = await fetchVkHtml(requestedUrl, context);
    return parseVkOpenGraph(page.html, page.url);
  },
  parse: parseVkOpenGraph,
};

function parseVkOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  if (isVkMissingWallPage(html, pageUrl)) {
    return {
      ...preview,
      providerData: { provider: 'vk', status: 'deleted' } as const,
    };
  }
  const structuredVideo = parseVkStructuredVideo(html, pageUrl);
  const images = parseVkPostPhotos(html, pageUrl);
  return {
    ...preview,
    image: normalizeVkImage(preview.image ?? images[0] ?? structuredVideo?.image ?? null),
    video: preview.video ?? structuredVideo?.embedUrl ?? null,
    ...(images.length > 1 && !preview.video && !structuredVideo
      ? { providerData: { provider: 'vk', images } as const }
      : {}),
  };
}

function parseVkPostPhotos(html: string, pageUrl: URL): string[] {
  const postId = pageUrl.pathname.match(/^\/wall(-?\d+_\d+)\/?$/i)?.[1];
  if (postId && html.includes('data-testid="media-grid"')) {
    const { document } = parseHTML(html);
    const post = [...document.querySelectorAll('[data-testid="post"]')]
      .find((element) => element.getAttribute('data-post-id') === postId);
    const images = [...(post?.querySelectorAll('[data-testid="media-grid"] a[href^="/photo"] img') ?? [])]
      .map((image) => resolveHttpUrl(decodeHtml(image.getAttribute('src') ?? ''), pageUrl))
      .filter((image): image is string => Boolean(image))
      .map((image) => {
        const url = new URL(image);
        if (!isVkImageHost(url.hostname)) return null;
        url.searchParams.delete('cs');
        return normalizeVkImage(url.href);
      })
      .filter((image): image is string => Boolean(image));
    if (images.length > 1) return [...new Set(images)];
  }
  return parseVkImages(html, pageUrl);
}

function parseVkImages(html: string, pageUrl: URL): string[] {
  const images: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    if (!['og:image', 'og:image:url'].includes(attributes.property?.toLowerCase() ?? '')) continue;
    const image = normalizeVkImage(resolveHttpUrl(decodeHtml(attributes.content ?? ''), pageUrl));
    if (image && !images.includes(image)) images.push(image);
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data: unknown = JSON.parse(match[1] ?? '');
      if (!isRecord(data) || data['@type'] !== 'SocialMediaPosting') continue;
      const listed = Array.isArray(data.image) ? data.image : [];
      for (const entry of listed) {
        if (typeof entry !== 'string') continue;
        const image = normalizeVkImage(resolveHttpUrl(entry, pageUrl));
        if (image && !images.includes(image)) images.push(image);
      }
    } catch { /* Ignore malformed structured data. */ }
  }
  return images;
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
