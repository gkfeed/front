import { normalizeHostname } from '../../../shared/urlRules.js';
import { decodeHtml, parseAttributes, resolveHttpUrl } from '../html.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { PreviewError } from '../errors.js';

const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';
const REZKA_ITEM_PATH = /^\/(?:films|series|animation|cartoons)\/[^/]+\/(\d+)-([a-z0-9-]+)\.html$/;

export const rezkaOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isRezkaUrl,
  async fetch(requestedUrl, context) {
    let firstPreview: ReturnType<typeof parseRezkaOpenGraph> | null = null;
    let lastError: unknown = null;

    const previewUrls = getRezkaPreviewUrls(requestedUrl);
    for (const url of previewUrls) {
      try {
        const page = await fetchHtml(url, REZKA_USER_AGENT, {}, context);
        const preview = parseRezkaOpenGraph(page.html, page.url);
        if (preview.image) return preview;
        firstPreview ??= preview;
      } catch (error) {
        if (context?.signal.aborted) throw error;
        lastError = error;
      }
    }

    const searchUrl = getRezkaSearchUrl(requestedUrl);
    if (searchUrl) {
      try {
        const searchPage = await fetchHtml(searchUrl, REZKA_USER_AGENT, {
          maxBytes: 256_000,
          truncateAtLimit: true,
        }, context);
        const matchUrl = parseRezkaSearchResult(searchPage.html, requestedUrl);
        if (matchUrl && !previewUrls.some((url) => url.href === matchUrl.href)) {
          const page = await fetchHtml(matchUrl, REZKA_USER_AGENT, {}, context);
          const preview = parseRezkaOpenGraph(page.html, page.url);
          if (preview.image) return preview;
          firstPreview ??= preview;
        }
      } catch (error) {
        if (context?.signal.aborted) throw error;
        lastError = error;
      }
    }

    if (firstPreview) return firstPreview;
    if (lastError) throw lastError;
    throw new PreviewError('The Rezka page could not be fetched', 'fetch_failed');
  },
  parse: parseRezkaOpenGraph,
};

function parseRezkaOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  return { ...preview, image: parseRezkaOriginalCover(html, pageUrl) ?? preview.image };
}

function isRezkaUrl(url: URL): boolean {
  return ['hdrezka.me', 'rezka.ag'].includes(normalizeHostname(url.hostname));
}

function getRezkaPreviewUrls(url: URL): URL[] {
  const base = getRezkaBaseUrl(url);
  const urls = normalizeHostname(url.hostname) === 'hdrezka.me'
    ? [withRezkaHost(base, 'rezka.ag'), base]
    : [base];
  return [
    ...urls,
    ...urls.flatMap((candidate) => getRezkaLatestUrl(candidate) ?? []),
    ...urls.flatMap((candidate) => getRezkaAlternateUrl(candidate) ?? []),
  ];
}

function withRezkaHost(url: URL, host: string): URL {
  const result = new URL(url.href);
  result.host = host;
  return result;
}

function getRezkaLatestUrl(url: URL): URL | null {
  if (!REZKA_ITEM_PATH.test(url.pathname) || url.pathname.endsWith('-latest.html')) return null;
  const result = new URL(url.href);
  result.pathname = result.pathname.replace(/\.html$/, '-latest.html');
  return result;
}

function getRezkaAlternateUrl(url: URL): URL | null {
  if (!REZKA_ITEM_PATH.test(url.pathname) || url.pathname.endsWith('-u.html')) return null;
  const result = new URL(url.href);
  result.pathname = result.pathname.replace(/\.html$/, '-u.html');
  return result;
}

function getRezkaBaseUrl(url: URL): URL {
  if (!url.pathname.endsWith('-latest.html')) return url;
  const result = new URL(url.href);
  result.pathname = result.pathname.replace(/-latest\.html$/, '.html');
  return result;
}

function getRezkaSearchUrl(url: URL): URL | null {
  const slug = url.pathname.match(REZKA_ITEM_PATH)?.[2]
    ?.replace(/-latest$/, '').replace(/-u$/, '');
  if (!slug || slug.length > 150) return null;
  const searchUrl = new URL('https://rezka.ag/search/');
  searchUrl.searchParams.set('do', 'search');
  searchUrl.searchParams.set('subaction', 'search');
  searchUrl.searchParams.set('q', slug);
  return searchUrl;
}

function parseRezkaSearchResult(html: string, requestedUrl: URL): URL | null {
  const id = requestedUrl.pathname.match(REZKA_ITEM_PATH)?.[1];
  if (!id) return null;
  for (const tag of html.match(/<div\b[^>]*\bdata-id\s*=\s*["']?\d+[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    if (attributes['data-id'] !== id || !attributes['data-url']) continue;
    try {
      const url = new URL(attributes['data-url']);
      if (url.protocol === 'https:' && normalizeHostname(url.hostname) === 'rezka.ag'
        && url.pathname.match(REZKA_ITEM_PATH)?.[1] === id) {
        return url;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function parseRezkaOriginalCover(html: string, pageUrl: URL): string | null {
  if (!['hdrezka.me', 'rezka.ag'].includes(normalizeHostname(pageUrl.hostname))) return null;
  const coverStart = html.match(
    /<[a-z][^>]*\bclass\s*=(?:"[^"]*\bb-sidecover\b[^"]*"|'[^']*\bb-sidecover\b[^']*'|[^\s>]*\bb-sidecover\b[^\s>]*)[^>]*>/i,
  );
  if (!coverStart || coverStart.index === undefined) return null;
  const coverMarkup = html.slice(coverStart.index, coverStart.index + 8_000);
  const linkTag = coverMarkup.match(/<a\b[^>]*>/i)?.[0];
  const imageTag = coverMarkup.match(/<img\b[^>]*>/i)?.[0];
  const linkAttributes = linkTag ? parseAttributes(linkTag) : null;
  const imageAttributes = imageTag ? parseAttributes(imageTag) : null;
  const source = linkAttributes?.href
    ?? imageAttributes?.['data-original']
    ?? imageAttributes?.['data-src']
    ?? imageAttributes?.src;
  return resolveHttpUrl(source ? decodeHtml(source) : null, pageUrl);
}
