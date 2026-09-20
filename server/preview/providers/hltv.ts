import { isHltvMatchUrl } from '../../../shared/urlRules.js';
import { isOpenGraphPreview } from '../../../shared/previewGuards.js';
import type { OpenGraphPreview } from '../../../shared/previewContracts.js';
import type { HltvPage } from '../hltvFetcher.js';
import { fetchHltvHtml } from '../hltvFetcher.js';
import { PreviewError } from '../errors.js';
import { parseHltvProviderData } from '../hltvProviderParser.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { parseOpenGraph } from '../openGraphParser.js';

export const hltvOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isHltvMatchUrl,
  async fetch(requestedUrl, context) {
    try {
      const page = await fetchHltvHtml(requestedUrl, context);
      return enrichHltvPreview(parseHltvOpenGraph(page.html, page.url), page);
    } catch (error) {
      if (!(error instanceof PreviewError) || error.kind !== 'fetch_failed') throw error;
      const fallback = await fetchConfiguredHltvPreview(requestedUrl, context?.signal);
      if (fallback) return fallback;
      throw error;
    }
  },
  parse: parseHltvOpenGraph,
};

async function fetchConfiguredHltvPreview(
  requestedUrl: URL,
  signal?: AbortSignal,
): Promise<OpenGraphPreview | null> {
  const origin = process.env.HLTV_PREVIEW_FALLBACK_ORIGIN?.trim();
  if (!origin) return null;

  let endpoint: URL;
  try {
    endpoint = new URL('/bff/open-graph', origin);
    if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  endpoint.searchParams.set('url', requestedUrl.href);

  try {
    const response = await fetch(endpoint, {
      headers: { accept: 'application/json' },
      signal,
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return isOpenGraphPreview(value) ? value : null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return null;
  }
}

function parseHltvOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  return {
    ...parseOpenGraph(html, pageUrl),
    providerData: parseHltvProviderData(html, pageUrl),
  };
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
