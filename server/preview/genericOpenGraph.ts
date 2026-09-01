import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { fetchHtml } from './pageFetcher.js';
import { parseOpenGraph } from './openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

export async function fetchGenericOpenGraph(
  requestedUrl: URL,
  context?: RequestExecutionContext,
): Promise<OpenGraphPreview> {
  const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {}, context);
  return parseOpenGraph(page.html, page.url);
}
