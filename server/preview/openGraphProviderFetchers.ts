import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import { normalizeHostname } from '../../shared/urlRules.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from './errors.js';
import { fetchHtml } from './pageFetcher.js';
import type { HltvPage } from './hltvFetcher.js';
import { parseOpenGraph } from './openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';

export async function fetchMatreshkaOpenGraph(
  requestedUrl: URL,
  context?: RequestExecutionContext,
): Promise<OpenGraphPreview> {
  const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {
    maxBytes: 2_000_000,
    truncateAtLimit: true,
  }, context);
  return parseOpenGraph(page.html, page.url);
}

export async function fetchInstagramOpenGraph(
  requestedUrl: URL,
  context?: RequestExecutionContext,
): Promise<OpenGraphPreview> {
  const embedUrl = new URL(requestedUrl.href);
  embedUrl.protocol = 'https:';
  embedUrl.hostname = 'www.instagram.com';
  embedUrl.search = '';
  embedUrl.hash = '';
  embedUrl.pathname = `${embedUrl.pathname
    .replace(/^\/reels\//i, '/reel/')
    .replace(/\/$/, '')}/embed/`;
  const page = await fetchHtml(embedUrl, TWITTERBOT_USER_AGENT, {}, context);
  return parseOpenGraph(page.html, requestedUrl);
}

export async function fetchRezkaOpenGraph(
  requestedUrl: URL,
  context?: RequestExecutionContext,
): Promise<OpenGraphPreview> {
  let firstPreview: OpenGraphPreview | null = null;
  let lastError: unknown = null;

  for (const url of getRezkaPreviewUrls(requestedUrl)) {
    try {
      const page = await fetchHtml(url, REZKA_USER_AGENT, {}, context);
      const preview = parseOpenGraph(page.html, page.url);
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
}

export function enrichHltvPreview(preview: OpenGraphPreview, page: HltvPage): OpenGraphPreview {
  if (preview.providerData?.provider !== 'hltv') return preview;
  const { snapshot } = preview.providerData;
  return {
    ...preview,
    providerData: {
      ...preview.providerData,
      snapshot: {
        ...snapshot,
        currentMap: page.currentMap ?? snapshot.currentMap,
        roundHistory: page.roundHistory ?? snapshot.roundHistory ?? null,
        playerStats: page.playerStats ?? snapshot.playerStats,
        teamSides: page.teamSides ?? snapshot.teamSides,
      },
    },
  };
}

export function isRezkaUrl(url: URL): boolean {
  return ['hdrezka.me', 'rezka.ag'].includes(normalizeHostname(url.hostname));
}

function getRezkaPreviewUrls(url: URL): URL[] {
  if (normalizeHostname(url.hostname) !== 'hdrezka.me') return [url];
  const mirrorUrl = new URL(url.href);
  mirrorUrl.host = 'rezka.ag';
  return [mirrorUrl, url];
}
