import { normalizeHostname } from '../../../shared/urlRules.js';

export function parseSasflixVideoUrl(html: string, pageUrl: URL): string | null {
  if (
    normalizeHostname(pageUrl.hostname) !== 'sasflix.ru'
    || pageUrl.protocol !== 'https:'
    || pageUrl.username
    || pageUrl.password
    || pageUrl.port
    || !/^\/[a-z0-9_-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(pageUrl.pathname)
  ) return null;

  const videoId = html.match(
    /(?:https:\\u002F\\u002Fsasflix\.ru\\u002F|https:\/\/sasflix\.ru\/|\/)?api\/poster\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:[/?"'\\]|$)/i,
  )?.[1];
  return videoId ? `https://sasflix.ru/api/video/${videoId}.m3u8` : null;
}
