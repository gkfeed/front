import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import {
  isInstagramMediaUrl,
  isMatreshkaVideoUrl,
  isOneFootballMatchUrl,
  isSasflixPublicationUrl,
} from '../../shared/urlRules.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchHltvHtml } from './hltvFetcher.js';
import { isHltvMatchUrl, parseOpenGraph } from './openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import {
  enrichHltvPreview,
  fetchInstagramOpenGraph,
  fetchMatreshkaOpenGraph,
  fetchRezkaOpenGraph,
  isRezkaUrl,
} from './openGraphProviderFetchers.js';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export { parseLiquipediaMatch } from './liquipediaParser.js';
export { fetchLiquipediaMatch } from './liquipedia.js';
export { fetchRedditPreviewImage } from './reddit.js';
export { PreviewError } from './errors.js';
export {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvScorebotParser.js';
export { parseOpenGraph } from './openGraphParser.js';

export async function fetchOpenGraph(input: string, context?: RequestExecutionContext): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  if (isRezkaUrl(requestedUrl)) return fetchRezkaOpenGraph(requestedUrl, context);
  if (isMatreshkaVideoUrl(requestedUrl)) return fetchMatreshkaOpenGraph(requestedUrl, context);
  if (isInstagramMediaUrl(requestedUrl)) return fetchInstagramOpenGraph(requestedUrl, context);

  if (isOneFootballMatchUrl(requestedUrl)) {
    // OneFootball sends social crawlers a metadata-only page without the score.
    const page = await fetchHtml(requestedUrl, BROWSER_USER_AGENT, {}, context);
    return parseOpenGraph(page.html, page.url);
  }

  if (isHltvMatchUrl(requestedUrl)) {
    const page = await fetchHltvHtml(requestedUrl, context);
    return enrichHltvPreview(parseOpenGraph(page.html, page.url), page);
  }

  const page = await fetchHtml(
    requestedUrl,
    TWITTERBOT_USER_AGENT,
    isSasflixPublicationUrl(requestedUrl)
      ? { maxBytes: 256_000, truncateAtLimit: true }
      : {},
    context,
  );
  return parseOpenGraph(page.html, page.url);
}
