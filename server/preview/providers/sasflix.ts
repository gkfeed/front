import { isSasflixPublicationUrl, normalizeHostname } from '../../../shared/urlRules.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';

export const sasflixOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isSasflixPublicationUrl,
  async fetch(requestedUrl, context) {
    const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {
      maxBytes: 256_000,
      truncateAtLimit: true,
    }, context);
    return parseSasflixOpenGraph(page.html, page.url);
  },
  parse: parseSasflixOpenGraph,
};

function parseSasflixOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  return { ...preview, video: parseSasflixVideoUrl(html, pageUrl) ?? preview.video };
}

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
