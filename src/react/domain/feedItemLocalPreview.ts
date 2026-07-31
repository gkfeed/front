import type { FeedItem } from '../types';
import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type {
  FeedItemAnalysis,
  FeedItemPreview,
} from './feedItemPreviewTypes';
import { getFeedItemProviderFromUrl } from './feedItemProviders';
import {
  getYoutubeVideoId,
  hostnameOf,
  isDirectImage,
  isDirectVideo,
  isDirectVideoValue,
  isVkHost,
  isVkImageHost,
  parseUrl,
} from './feedItemUrls';

export function analyzeFeedItem(item: FeedItem): FeedItemAnalysis {
  const url = parseUrl(item.link);
  return {
    url,
    hostname: url ? hostnameOf(url) : null,
    provider: getFeedItemProviderFromUrl(item, url),
    localPreview: getFeedItemPreviewFromUrl(item, url),
    youtubeVideoId: url ? getYoutubeVideoId(url) : null,
  };
}

export function getFeedItemPreview(item: FeedItem): FeedItemPreview | null {
  return getFeedItemPreviewFromUrl(item, parseUrl(item.link));
}

export function getTikTokEmbedPreview(item: FeedItem): FeedItemPreview | null {
  const url = parseUrl(item.link);
  const videoId = url?.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  const parameters = new URLSearchParams({
    autoplay: '1',
    muted: '0',
    loop: '1',
    controls: '1',
    music_info: '0',
    description: '0',
    rel: '0',
  });
  return {
    src: `https://www.tiktok.com/player/v1/${videoId}?${parameters}`,
    alt: { kind: 'tiktok', title: item.title || null },
    type: 'embed',
  };
}

export function getRemoteFeedItemPreview(
  preview: OpenGraphPreview | null,
  title: string,
): FeedItemPreview | null {
  if (!preview) return null;
  const altTitle = preview.title || title;

  if (preview.video) {
    const videoUrl = parseUrl(preview.video);
    const vkVideoPreview = videoUrl ? getVkVideoPreview(videoUrl, altTitle) : null;
    if (vkVideoPreview) return vkVideoPreview;
  }

  if (preview.video && isDirectVideoValue(preview.video)) {
    return {
      src: preview.video,
      alt: { kind: 'video', title: altTitle || null },
      type: 'video',
      ...(preview.image ? { poster: preview.image } : {}),
    };
  }

  return preview.image ? {
    src: preview.image,
    alt: { kind: 'item', title: altTitle || null },
  } : null;
}

export function isGenericHltvPreview(source: string): boolean {
  const url = parseUrl(source);
  return url?.hostname.replace(/^www\./, '').toLowerCase() === 'hltv.org'
    && url.pathname === '/img/static/openGraphHltvLogo.png';
}

function getFeedItemPreviewFromUrl(item: FeedItem, url: URL | null): FeedItemPreview | null {
  if (!url) return getEmbeddedImage(item.text, item.title);

  const vkVideoEmbed = getVkVideoPreview(url, item.title);
  if (vkVideoEmbed) return vkVideoEmbed;

  if (isDirectImage(url)) {
    return { src: url.href, alt: { kind: 'item', title: item.title || null } };
  }

  if (isDirectVideo(url)) {
    return {
      src: url.href,
      alt: { kind: 'video', title: item.title || null },
      type: 'video',
    };
  }

  const hostname = hostnameOf(url);
  if (hostname === 'twitch.tv') {
    const channel = url.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      return {
        src: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel)}-1920x1080.jpg`,
        alt: { kind: 'twitch', channel },
      };
    }
  }

  const youtubeId = getYoutubeVideoId(url);
  if (youtubeId) {
    return {
      src: `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/maxresdefault.jpg`,
      fallbackSrc: `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`,
      alt: { kind: 'youtube', title: item.title || null },
    };
  }

  return getEmbeddedImage(item.text, item.title);
}

function getEmbeddedImage(html: string, title: string): FeedItemPreview | null {
  if (!html || typeof DOMParser === 'undefined') return null;

  const document = new DOMParser().parseFromString(html, 'text/html');
  const frameSource = document.querySelector('iframe')?.getAttribute('src');
  if (frameSource) {
    const frameUrl = parseUrl(frameSource);
    const vkVideoEmbed = frameUrl ? getVkVideoPreview(frameUrl, title) : null;
    if (vkVideoEmbed) return vkVideoEmbed;
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

export function getVkVideoPreview(url: URL, title: string): FeedItemPreview | null {
  if (!isVkHost(url.hostname)) return null;

  if (/^\/(?:video|clip)_ext\.php$/i.test(url.pathname)) {
    const ownerId = url.searchParams.get('oid');
    const videoId = url.searchParams.get('id');
    if (!isVkMediaId(ownerId) || !isVkMediaId(videoId, false)) return null;

    const embedUrl = new URL(url.href);
    embedUrl.protocol = 'https:';
    embedUrl.hostname = 'vk.com';
    embedUrl.searchParams.set('autoplay', '1');
    return {
      src: embedUrl.href,
      alt: { kind: 'vk', title: title || null },
      type: 'embed',
    };
  }

  const mediaReference = getVkMediaReference(url);
  if (!mediaReference) return null;
  const [, mediaType, ownerId, videoId] = mediaReference;
  const embedUrl = new URL(`https://vk.com/${mediaType}_ext.php`);
  embedUrl.searchParams.set('oid', ownerId!);
  embedUrl.searchParams.set('id', videoId!);
  embedUrl.searchParams.set('hd', '2');
  embedUrl.searchParams.set('autoplay', '1');

  return {
    src: embedUrl.href,
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
  const url = parseUrl(source);
  if (url?.protocol === 'http:' && isVkImageHost(url.hostname)) {
    url.protocol = 'https:';
    return url.href;
  }
  return source;
}
