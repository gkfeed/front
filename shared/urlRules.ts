const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const TIKTOK_HOSTS = ['tiktok.com'] as const;
const VK_HOSTS = ['vk.com', 'vk.ru', 'vkvideo.ru'] as const;
const VK_IMAGE_HOSTS = ['vkuserphoto.ru', 'userapi.com'] as const;
const REDDIT_VIDEO_HOST = 'v.redd.it';
const HLTV_MATCH_PATH = /^\/matches\/\d+(?:\/|$)/;
const LIQUIPEDIA_MATCH_PATH = /\/Match(?::|%3A)/i;
const TIKTOK_VIDEO_PATH = /\/(?:video|v)\/\d+(?:\/|$)/;
const REDDIT_VIDEO_PATH = /^\/[\w-]+(?:\/DASH_[^/]+\.mp4)?\/?$/i;

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

function isHostnameOrSubdomain(hostname: string, domains: readonly string[]): boolean {
  const normalized = normalizeHostname(hostname);
  return domains.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

export function isHltvMatchUrl(url: URL): boolean {
  return normalizeHostname(url.hostname) === 'hltv.org'
    && HLTV_MATCH_PATH.test(url.pathname);
}

export function isTikTokVideoUrl(url: URL): boolean {
  return HTTP_PROTOCOLS.has(url.protocol)
    && isHostnameOrSubdomain(url.hostname, TIKTOK_HOSTS)
    && TIKTOK_VIDEO_PATH.test(url.pathname);
}

export function isRedditVideoUrl(url: URL): boolean {
  return HTTP_PROTOCOLS.has(url.protocol)
    && normalizeHostname(url.hostname) === REDDIT_VIDEO_HOST
    && REDDIT_VIDEO_PATH.test(url.pathname);
}

export function isLiquipediaMatchUrl(url: URL): boolean {
  return normalizeHostname(url.hostname) === 'liquipedia.net'
    && LIQUIPEDIA_MATCH_PATH.test(url.pathname);
}

export function isVkHost(hostname: string): boolean {
  return isHostnameOrSubdomain(hostname, VK_HOSTS);
}

export function isVkImageHost(hostname: string): boolean {
  return isHostnameOrSubdomain(hostname, VK_IMAGE_HOSTS);
}
