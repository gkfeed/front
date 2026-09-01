import { isHltvMatchUrl } from '../../../shared/urlRules.js';
import type { OpenGraphPreview } from '../../../shared/previewContracts.js';
import type { HltvPage } from '../hltvFetcher.js';
import { fetchHltvHtml } from '../hltvFetcher.js';
import { parseHltvProviderData } from '../hltvProviderParser.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { parseOpenGraph } from '../openGraphParser.js';

export const hltvOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isHltvMatchUrl,
  async fetch(requestedUrl, context) {
    const page = await fetchHltvHtml(requestedUrl, context);
    return enrichHltvPreview(parseHltvOpenGraph(page.html, page.url), page);
  },
  parse: parseHltvOpenGraph,
};

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
