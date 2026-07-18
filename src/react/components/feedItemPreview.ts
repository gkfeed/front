import type { FeedItem } from '../types';

interface FeedItemPreview {
  src: string;
  alt: string;
}

export function getFeedItemPreview(item: FeedItem): FeedItemPreview | null {
  const url = parseUrl(item.link);
  if (!url) return getEmbeddedImage(item.text, item.title);

  if (isDirectImage(url)) {
    return { src: url.href, alt: item.title ? `Preview for ${item.title}` : 'Feed item preview' };
  }

  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

  if (hostname === 'twitch.tv') {
    const channel = url.pathname.split('/').filter(Boolean)[0];
    if (channel) {
      return {
        src: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel)}-1280x720.jpg`,
        alt: `${channel} Twitch preview`,
      };
    }
  }

  const youtubeId = getYoutubeVideoId(url);
  if (youtubeId) {
    return {
      src: `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`,
      alt: item.title ? `Preview for ${item.title}` : 'YouTube video preview',
    };
  }

  return getEmbeddedImage(item.text, item.title);
}

export function isYoutubeFeedItem(item: FeedItem): boolean {
  const url = parseUrl(item.link);
  return Boolean(url && getYoutubeVideoId(url));
}

function getEmbeddedImage(html: string, title: string): FeedItemPreview | null {
  if (!html || typeof DOMParser === 'undefined') return null;

  const source = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src');
  if (!source || !isSafeImageSource(source)) return null;

  return {
    src: source,
    alt: title ? `Preview for ${title}` : 'Feed item preview',
  };
}

function isSafeImageSource(source: string): boolean {
  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(source)) return true;
  const url = parseUrl(source);
  return Boolean(url && ['http:', 'https:'].includes(url.protocol));
}

function isDirectImage(url: URL): boolean {
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
}

function getYoutubeVideoId(url: URL): string | null {
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

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
