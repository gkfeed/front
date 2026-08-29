import { normalizeHostname } from '../../../shared/urlRules';

export function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function hostnameOf(url: URL): string {
  return normalizeHostname(url.hostname);
}

export { isRedditVideoUrl, isVkHost, isVkImageHost } from '../../../shared/urlRules';

export function isRedditUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = hostnameOf(url);
  return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
}

export function isRezkaUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = hostnameOf(url);
  return hostname === 'hdrezka.me' || hostname === 'rezka.ag';
}

export function isDirectImage(url: URL): boolean {
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
}

export function isDirectVideo(url: URL): boolean {
  return /\.(?:m4v|mov|mp4|webm)$/i.test(url.pathname);
}

export function isDirectVideoValue(value: string): boolean {
  return /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i.test(value);
}

export function getYoutubeVideoId(url: URL): string | null {
  const hostname = hostnameOf(url);
  let videoId: string | null = null;

  if (hostname === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (['youtube.com', 'm.youtube.com'].includes(hostname)) {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    if (/^\/(?:shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2] ?? null;
  }

  return videoId && /^[\w-]{6,}$/.test(videoId) ? videoId : null;
}

export function getMatreshkaVideoId(url: URL): string | null {
  if (
    url.protocol !== 'https:'
    || hostnameOf(url) !== 'matreshka.tv'
    || url.username
    || url.password
    || url.port
  ) return null;

  const videoId = url.pathname.match(/^\/(?:video|embed\/video)\/([A-Za-z0-9_-]{1,64})\/?$/i)?.[1] ?? null;
  return videoId;
}

export function getSasflixPublicationId(url: URL): string | null {
  if (
    url.protocol !== 'https:'
    || hostnameOf(url) !== 'sasflix.ru'
    || url.username
    || url.password
    || url.port
  ) return null;

  const match = url.pathname.match(
    /^\/[a-z0-9_-]+\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i,
  );
  return match?.[1] ?? null;
}

// Re-export shared helper for server/client consistency checks.
export { isSasflixPublicationUrl } from '../../../shared/urlRules';
