import { normalizeHostname } from '../../../shared/urlRules.js';
import { isMatreshkaVideoUrl } from '../../../shared/urlRules.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';
import { decodeHtml } from '../html.js';

export const matreshkaOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isMatreshkaVideoUrl,
  async fetch(requestedUrl, context) {
    const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {
      maxBytes: 2_000_000,
      truncateAtLimit: true,
    }, context);
    return parseMatreshkaOpenGraph(page.html, page.url);
  },
  parse: parseMatreshkaOpenGraph,
};

function parseMatreshkaOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  return { ...preview, video: parseMatreshkaVideoUrl(html, pageUrl) ?? preview.video };
}

export function parseMatreshkaVideoUrl(html: string, pageUrl: URL): string | null {
  if (
    normalizeHostname(pageUrl.hostname) !== 'matreshka.tv'
    || !/^\/(?:video|embed\/video)\/[A-Za-z0-9_-]{1,64}\/?$/i.test(pageUrl.pathname)
  ) return null;

  const normalized = html
    .replace(/\\u003A/gi, ':')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/');
  const streams = Array.from(normalized.matchAll(
    /"(\d{3,4})"\s*:\s*"(https:\/\/[^"\\]+\/master\.m3u8\?[^"\\]+)"/gi,
  )).map((match) => ({
    height: Number(match[1]),
    url: validateMatreshkaVideoUrl(decodeHtml(match[2]!)),
  })).filter((stream): stream is { height: number; url: string } => Boolean(stream.url));

  streams.sort((first, second) => second.height - first.height);
  return streams[0]?.url ?? null;
}

function validateMatreshkaVideoUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return url.protocol === 'https:'
    && /^c\d+-video\.cmtv\.ru$/i.test(url.hostname)
    && /^\/hm\/[A-Za-z0-9_-]+\/[A-Za-z0-9+/=_-]+\/master\.m3u8$/i.test(url.pathname)
    && url.searchParams.has('expires')
    && url.searchParams.has('md5')
    ? url.href
    : null;
}
