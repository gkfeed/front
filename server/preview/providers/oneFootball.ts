import { isOneFootballMatchUrl } from '../../../shared/urlRules.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { parseOneFootballProviderData } from '../oneFootballProviderParser.js';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export const oneFootballOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isOneFootballMatchUrl,
  async fetch(requestedUrl, context) {
    // OneFootball sends social crawlers a metadata-only page without the score.
    const page = await fetchHtml(requestedUrl, BROWSER_USER_AGENT, {}, context);
    return parseOneFootballOpenGraph(page.html, page.url);
  },
  parse: parseOneFootballOpenGraph,
};

function parseOneFootballOpenGraph(html: string, pageUrl: URL) {
  return {
    ...parseOpenGraph(html, pageUrl),
    providerData: parseOneFootballProviderData(html, pageUrl),
  };
}
