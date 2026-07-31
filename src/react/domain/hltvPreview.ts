import { hostnameOf, parseUrl } from './feedItemUrls';

export function isGenericHltvPreview(source: string): boolean {
  const url = parseUrl(source);
  return url !== null
    && hostnameOf(url) === 'hltv.org'
    && url.pathname === '/img/static/openGraphHltvLogo.png';
}
