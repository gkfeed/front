import type { FeedItem } from '../types';
import type { OpenGraphPreview } from '../../../shared/previewContracts';

export interface FeedItemPreview {
  src: string;
  alt: string;
  type?: 'video' | 'embed';
  poster?: string;
  fallbackSrc?: string;
}

export type FeedItemProvider =
  | 'generic'
  | 'hltv'
  | 'instagram'
  | 'liquipedia'
  | 'tiktok'
  | 'vk'
  | 'youtube';

export interface FeedItemAnalysis {
  url: URL | null;
  hostname: string;
  provider: FeedItemProvider;
  localPreview: FeedItemPreview | null;
  youtubeVideoId: string | null;
}

export function analyzeFeedItem(item: FeedItem): FeedItemAnalysis {
  const url = parseUrl(item.link);
  return {
    url,
    hostname: url?.hostname.replace(/^www\./, '').toLowerCase() || 'Feed item',
    provider: getFeedItemProviderFromUrl(item, url),
    localPreview: getFeedItemPreviewFromUrl(item, url),
    youtubeVideoId: url ? getYoutubeVideoId(url) : null,
  };
}

export function getFeedItemPreview(item: FeedItem): FeedItemPreview | null {
  const url = parseUrl(item.link);
  return getFeedItemPreviewFromUrl(item, url);
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
    alt: item.title ? `Video preview for ${item.title}` : 'TikTok video preview',
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
      alt: altTitle ? `Video preview for ${altTitle}` : 'Feed item video preview',
      type: 'video',
      ...(preview.image ? { poster: preview.image } : {}),
    };
  }

  return preview.image ? {
    src: preview.image,
    alt: altTitle ? `Preview for ${altTitle}` : 'Feed item preview',
  } : null;
}

export function isGenericHltvPreview(source: string): boolean {
  const url = parseUrl(source);
  return url?.hostname.replace(/^www\./, '').toLowerCase() === 'hltv.org'
    && url.pathname === '/img/static/openGraphHltvLogo.png';
}

export function isRedditUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
}

export function isRezkaUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  return hostname === 'hdrezka.me' || hostname === 'rezka.ag';
}

function getFeedItemPreviewFromUrl(item: FeedItem, url: URL | null): FeedItemPreview | null {
  if (!url) return getEmbeddedImage(item.text, item.title);

  const vkVideoEmbed = getVkVideoPreview(url, item.title);
  if (vkVideoEmbed) return vkVideoEmbed;

  if (isDirectImage(url)) {
    return { src: url.href, alt: item.title ? `Preview for ${item.title}` : 'Feed item preview' };
  }

  if (isDirectVideo(url)) {
    return {
      src: url.href,
      alt: item.title ? `Video preview for ${item.title}` : 'Feed item video preview',
      type: 'video',
    };
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

  if (hostname === 'twitch.tv') {
    const channel = url.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      return {
        src: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel)}-1920x1080.jpg`,
        alt: `${channel} Twitch preview`,
      };
    }
  }

  const youtubeId = getYoutubeVideoId(url);
  if (youtubeId) {
    return {
      src: `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/maxresdefault.jpg`,
      fallbackSrc: `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`,
      alt: item.title ? `Preview for ${item.title}` : 'YouTube video preview',
    };
  }

  return getEmbeddedImage(item.text, item.title);
}

export function isYoutubeFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'youtube';
}

export function isTikTokFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'tiktok';
}

export function isInstagramFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'instagram';
}

export function isShortVideoFeedItem(item: FeedItem): boolean {
  const provider = getFeedItemProvider(item);
  return provider === 'instagram' || provider === 'tiktok';
}

export function isVkFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'vk';
}

export function isHltvFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'hltv';
}

export function isLiquipediaFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'liquipedia';
}

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
}

function getFeedItemProviderFromUrl(item: FeedItem, url: URL | null): FeedItemProvider {
  if (/^inst:\s*/i.test(item.title)) return 'instagram';

  if (!url) return 'generic';

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  if (getYoutubeVideoId(url)) return 'youtube';
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) return 'tiktok';
  if (
    hostname === 'vk.com'
    || hostname.endsWith('.vk.com')
    || hostname === 'vk.ru'
    || hostname.endsWith('.vk.ru')
    || hostname === 'vkvideo.ru'
    || hostname.endsWith('.vkvideo.ru')
  ) return 'vk';
  if (hostname === 'hltv.org' && /^\/matches\/\d+(?:\/|$)/.test(url.pathname)) return 'hltv';
  if (hostname === 'liquipedia.net' && /\/Match(?::|%3A)/i.test(url.pathname)) return 'liquipedia';
  return 'generic';
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
  const videoSource = video?.getAttribute('src') ??
    video?.querySelector('source')?.getAttribute('src');
  if (videoSource && isSafeMediaSource(videoSource)) {
    const poster = video?.getAttribute('poster');
    return {
      src: videoSource,
      alt: title ? `Video preview for ${title}` : 'Feed item video preview',
      type: 'video',
      ...(poster && isSafeImageSource(poster) ? { poster } : {}),
    };
  }

  const source = document.querySelector('img')?.getAttribute('src');
  const normalizedSource = source ? normalizeImageSource(source) : null;
  if (!normalizedSource || !isSafeImageSource(normalizedSource)) return null;

  return {
    src: normalizedSource,
    alt: title ? `Preview for ${title}` : 'Feed item preview',
  };
}

export function getVkVideoPreview(url: URL, title: string): FeedItemPreview | null {
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  if (
    hostname !== 'vk.com'
    && !hostname.endsWith('.vk.com')
    && hostname !== 'vk.ru'
    && !hostname.endsWith('.vk.ru')
    && hostname !== 'vkvideo.ru'
    && !hostname.endsWith('.vkvideo.ru')
  ) return null;

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
      alt: title ? `Video preview for ${title}` : 'VK video preview',
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
    alt: title ? `Video preview for ${title}` : 'VK video preview',
    type: 'embed',
  };
}

function getVkMediaReference(url: URL): RegExpMatchArray | null {
  const pathReference = url.pathname.match(/^\/(video|clip)(-?\d+)_(\d+)(?:\/|$)/i);
  if (pathReference) return pathReference;

  const zReference = url.searchParams.get('z')?.match(/^(video|clip)(-?\d+)_(\d+)(?:\/|$)/i);
  return zReference ?? null;
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

function isVkImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'vkuserphoto.ru'
    || normalized.endsWith('.vkuserphoto.ru')
    || normalized === 'userapi.com'
    || normalized.endsWith('.userapi.com');
}

function isDirectImage(url: URL): boolean {
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
}

function isDirectVideo(url: URL): boolean {
  return /\.(?:m4v|mov|mp4|webm)$/i.test(url.pathname);
}

function isDirectVideoValue(value: string): boolean {
  return /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i.test(value);
}

export function getYoutubeVideoId(url: URL): string | null {
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  let videoId: string | null = null;

  if (hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (['youtube.com', 'm.youtube.com'].includes(hostname)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    if (/^\/(?:shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2] ?? null;
  }

  return videoId && /^[\w-]{6,}$/.test(videoId) ? videoId : null;
}

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
