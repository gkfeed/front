import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchGenericOpenGraph } from './genericOpenGraph.js';
import { findOpenGraphProviderAdapter } from './openGraphProviderAdapters.js';
import { parseOpenGraph as parseGenericOpenGraph } from './openGraphParser.js';

export { parseLiquipediaMatch } from './liquipediaParser.js';
export { fetchLiquipediaMatch } from './liquipedia.js';
export { fetchRedditPreviewImage } from './reddit.js';
export { PreviewError } from './errors.js';
export {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvScorebotParser.js';
export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  return findOpenGraphProviderAdapter(pageUrl)?.parse(html, pageUrl)
    ?? parseGenericOpenGraph(html, pageUrl);
}

export async function fetchOpenGraph(input: string, context?: RequestExecutionContext): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  return findOpenGraphProviderAdapter(requestedUrl)?.fetch(requestedUrl, context)
    ?? fetchGenericOpenGraph(requestedUrl, context);
}
