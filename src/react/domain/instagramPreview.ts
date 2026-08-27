import type { FeedItemPreview } from './feedItemPreviewTypes';
import { hostnameOf, parseUrl } from './feedItemUrls';

const INSTAGRAM_MEDIA_PATH = /^\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{1,64})\/?$/i;

export function getInstagramEmbedUrl(value: string | URL): string | null {
  const url = typeof value === 'string' ? parseUrl(value) : value;
  if (
    !url
    || !['http:', 'https:'].includes(url.protocol)
    || hostnameOf(url) !== 'instagram.com'
    || url.username
    || url.password
    || url.port
  ) return null;

  const match = url.pathname.match(INSTAGRAM_MEDIA_PATH);
  if (!match) return null;

  const mediaType = match[1].toLowerCase() === 'reels' ? 'reel' : match[1].toLowerCase();
  const shortcode = match[2];
  return `https://www.instagram.com/${mediaType}/${shortcode}/embed/`;
}

export function isInstagramMediaUrl(url: URL): boolean {
  return getInstagramEmbedUrl(url) !== null;
}

export function getInstagramEmbedPreview(
  url: URL,
  title: string,
): FeedItemPreview | null {
  const embedUrl = getInstagramEmbedUrl(url);
  return embedUrl ? {
    src: embedUrl,
    alt: { kind: 'video', title: title || null },
    type: 'embed',
  } : null;
}

export function getKnownInstagramVideoEmbedPreview(
  url: URL,
  title: string,
): FeedItemPreview | null {
  const mediaType = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return ['reel', 'reels', 'tv'].includes(mediaType ?? '')
    ? getInstagramEmbedPreview(url, title)
    : null;
}

export function isAmbiguousInstagramPostUrl(url: URL): boolean {
  return hostnameOf(url) === 'instagram.com'
    && /^\/p\/[A-Za-z0-9_-]{1,64}\/?$/i.test(url.pathname);
}
