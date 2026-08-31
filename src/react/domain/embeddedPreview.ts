import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getVkVideoPreview } from './vkPreview';
import { isVkImageHost, parseUrl } from './feedItemUrls';
import { getShikimoriHighQualityImageUrl } from './shikimoriPreview';

export function getEmbeddedPreview(html: string, title: string): FeedItemPreview | null {
  if (!html || typeof DOMParser === 'undefined') return null;

  const document = new DOMParser().parseFromString(html, 'text/html');
  const frameSource = document.querySelector('iframe')?.getAttribute('src');
  if (frameSource) {
    const frameUrl = parseUrl(frameSource);
    const vkVideoPreview = frameUrl ? getVkVideoPreview(frameUrl, title) : null;
    if (vkVideoPreview) return vkVideoPreview;
  }

  const video = document.querySelector('video');
  const videoSource = video?.getAttribute('src') ?? video?.querySelector('source')?.getAttribute('src');
  if (videoSource && isSafeMediaSource(videoSource)) {
    const poster = video?.getAttribute('poster');
    return {
      src: videoSource,
      alt: { kind: 'video', title: title || null },
      type: 'video',
      ...(poster && isSafeImageSource(poster) ? { poster } : {}),
    };
  }

  const source = document.querySelector('img')?.getAttribute('src');
  const normalizedSource = source ? normalizeImageSource(source) : null;
  if (!normalizedSource || !isSafeImageSource(normalizedSource)) return null;

  return {
    src: normalizedSource,
    alt: { kind: 'item', title: title || null },
  };
}

function isSafeMediaSource(source: string): boolean {
  const url = parseUrl(source);
  return Boolean(url && ['http:', 'https:'].includes(url.protocol));
}

function isSafeImageSource(source: string): boolean {
  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(source)) return true;
  const url = parseUrl(source);
  return Boolean(url && ['http:', 'https:'].includes(url.protocol));
}

function normalizeImageSource(source: string): string {
  const highQualitySource = getShikimoriHighQualityImageUrl(source);
  if (highQualitySource !== source) return highQualitySource;

  const url = parseUrl(source);
  if (url?.protocol === 'http:' && isVkImageHost(url.hostname)) {
    url.protocol = 'https:';
    return url.href;
  }
  return source;
}
