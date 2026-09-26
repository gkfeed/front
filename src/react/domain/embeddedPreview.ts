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

  const imageUrls = [...document.querySelectorAll('img')]
    .map((image) => image.getAttribute('src'))
    .filter((source): source is string => Boolean(source))
    .map(normalizeImageSource)
    .filter(isSafeImageSource)
    .filter((source, index, sources) => sources.indexOf(source) === index);
  if (!imageUrls.length) return null;

  return {
    src: imageUrls[0]!,
    alt: { kind: 'item', title: title || null },
    ...(imageUrls.length > 1 ? { imageUrls } : {}),
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
