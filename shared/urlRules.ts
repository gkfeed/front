export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

export function isHltvMatchUrl(url: URL): boolean {
  return normalizeHostname(url.hostname) === 'hltv.org'
    && /^\/matches\/\d+(?:\/|$)/.test(url.pathname);
}

export function isVkImageHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === 'vkuserphoto.ru'
    || normalized.endsWith('.vkuserphoto.ru')
    || normalized === 'userapi.com'
    || normalized.endsWith('.userapi.com');
}
