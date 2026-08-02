import type { FeedItemPreview } from './feedItemPreviewTypes';
import { isVkHost } from './feedItemUrls';

export function getVkVideoPreview(url: URL, title: string): FeedItemPreview | null {
  if (!isVkHost(url.hostname)) return null;

  if (/^\/(?:video|clip)_ext\.php$/i.test(url.pathname)) {
    const ownerId = url.searchParams.get('oid');
    const videoId = url.searchParams.get('id');
    if (!isVkMediaId(ownerId) || !isVkMediaId(videoId, false)) return null;

    const embedUrl = new URL(url.href);
    embedUrl.protocol = 'https:';
    embedUrl.hostname = 'vk.com';
    embedUrl.searchParams.set('autoplay', '0');
    embedUrl.searchParams.set('muted', '0');
    return createVkPreview(embedUrl, title);
  }

  const mediaReference = getVkMediaReference(url);
  if (!mediaReference) return null;
  const [, mediaType, ownerId, videoId] = mediaReference;
  const embedUrl = new URL(`https://vk.com/${mediaType}_ext.php`);
  embedUrl.searchParams.set('oid', ownerId!);
  embedUrl.searchParams.set('id', videoId!);
  embedUrl.searchParams.set('hd', '2');
  embedUrl.searchParams.set('autoplay', '0');
  embedUrl.searchParams.set('muted', '0');

  return createVkPreview(embedUrl, title);
}

function createVkPreview(url: URL, title: string): FeedItemPreview {
  return {
    src: url.href,
    alt: { kind: 'vk', title: title || null },
    type: 'embed',
  };
}

function getVkMediaReference(url: URL): RegExpMatchArray | null {
  const pathReference = url.pathname.match(/^\/(video|clip)(-?\d+)_(\d+)(?:\/|$)/i);
  if (pathReference) return pathReference;

  return url.searchParams.get('z')?.match(/^(video|clip)(-?\d+)_(\d+)(?:\/|$)/i) ?? null;
}

function isVkMediaId(value: string | null, signed = true): value is string {
  return Boolean(value && (signed ? /^-?\d+$/.test(value) : /^\d+$/.test(value)));
}
