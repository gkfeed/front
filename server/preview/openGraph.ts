import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import { PreviewError } from './errors.js';
import { fetchLiquipediaMatch } from './liquipedia.js';
import { fetchRedditPreviewImage } from './reddit.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchHltvHtml } from './hltvFetcher.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';
import type { HltvPage } from './hltvFetcher.js';
import { isHltvMatchUrl, parseOpenGraph } from './openGraphParser.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import {
  isInstagramMediaUrl,
  isMatreshkaVideoUrl,
  isSasflixPublicationUrl,
  normalizeHostname,
} from '../../shared/urlRules.js';

export { parseLiquipediaMatch };
export { fetchLiquipediaMatch };
export { fetchRedditPreviewImage };
export { PreviewError };
export {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvScorebotParser.js';
export { parseOpenGraph } from './openGraphParser.js';

const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';

export async function fetchOpenGraph(input: string, context?: RequestExecutionContext): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  if (isRezkaUrl(requestedUrl)) {
    return fetchRezkaOpenGraph(requestedUrl, context);
  }

  if (isMatreshkaVideoUrl(requestedUrl)) {
    return fetchMatreshkaOpenGraph(requestedUrl, context);
  }

  if (isInstagramMediaUrl(requestedUrl)) {
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

  const url = requestedUrl;
  if (isHltvMatchUrl(url)) {
    const page = await fetchHltvHtml(url, context);
    return enrichHltvPreview(parseOpenGraph(page.html, page.url), page);
  }

  const page = await fetchHtml(
    url,
    TWITTERBOT_USER_AGENT,
    isSasflixPublicationUrl(requestedUrl)
      ? { maxBytes: 256_000, truncateAtLimit: true }
      : {},
    context,
  );
  return parseOpenGraph(page.html, page.url);
}

async function fetchMatreshkaOpenGraph(
  requestedUrl: URL,
  context?: RequestExecutionContext,
): Promise<OpenGraphPreview> {
  const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {
    maxBytes: 2_000_000,
    truncateAtLimit: true,
  }, context);
  return parseOpenGraph(page.html, page.url);
}

async function fetchRezkaOpenGraph(
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

function enrichHltvPreview(preview: OpenGraphPreview, page: HltvPage): OpenGraphPreview {
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

function getRezkaPreviewUrls(url: URL): URL[] {
  if (normalizeHostname(url.hostname) !== 'hdrezka.me') return [url];
  const mirrorUrl = new URL(url.href);
  mirrorUrl.host = 'rezka.ag';
  return [mirrorUrl, url];
}

function isRezkaUrl(url: URL): boolean {
  return ['hdrezka.me', 'rezka.ag'].includes(normalizeHostname(url.hostname));
}
