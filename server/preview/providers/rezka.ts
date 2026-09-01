import { normalizeHostname } from '../../../shared/urlRules.js';
import { decodeHtml, parseAttributes, resolveHttpUrl } from '../html.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { PreviewError } from '../errors.js';

const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';

export const rezkaOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isRezkaUrl,
  async fetch(requestedUrl, context) {
    let firstPreview: ReturnType<typeof parseRezkaOpenGraph> | null = null;
    let lastError: unknown = null;

    for (const url of getRezkaPreviewUrls(requestedUrl)) {
      try {
        const page = await fetchHtml(url, REZKA_USER_AGENT, {}, context);
        const preview = parseRezkaOpenGraph(page.html, page.url);
        if (preview.image || url.href === requestedUrl.href) return preview;
        firstPreview ??= preview;
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
  if (normalizeHostname(url.hostname) !== 'hdrezka.me') return [url];
  const mirrorUrl = new URL(url.href);
  mirrorUrl.host = 'rezka.ag';
  return [mirrorUrl, url];
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
