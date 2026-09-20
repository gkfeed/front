import { normalizeHostname } from '../../../shared/urlRules.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';
import { decodeHtml, parseAttributes } from '../html.js';

export const shikimoriOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches(url) {
    return ['shikimori.io', 'shikimori.one'].includes(normalizeHostname(url.hostname))
      && /^\/animes\/\d+(?:[-/]|$)/i.test(url.pathname);
  },
  async fetch(requestedUrl, context) {
    const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {}, context);
    return parseShikimoriOpenGraph(page.html, page.url);
  },
  parse: parseShikimoriOpenGraph,
};

function parseShikimoriOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  return { ...preview, title: parseRussianTitle(html) ?? preview.title };
}

function parseRussianTitle(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    if (attributes.itemprop?.toLowerCase() !== 'alternativeheadline') continue;
    const title = attributes.content?.trim();
    if (title) return decodeHtml(title);
  }
  return null;
}
