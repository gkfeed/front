import {
  getMatreshkaVideoIdFromUrl,
  getSasflixPublicationIdFromUrl,
  getYoutubeVideoIdFromUrl,
  normalizeHostname,
} from '../../../shared/urlRules';

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

export function isTempfileUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = hostnameOf(url);
  return hostname === 'tempfile.org' || hostname.endsWith('.tempfile.org');
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
  return getYoutubeVideoIdFromUrl(url);
}

export function getMatreshkaVideoId(url: URL): string | null {
  return getMatreshkaVideoIdFromUrl(url);
}

export function getSasflixPublicationId(url: URL): string | null {
  return getSasflixPublicationIdFromUrl(url);
}

// Re-export shared helper for server/client consistency checks.
export { isSasflixPublicationUrl } from '../../../shared/urlRules';
