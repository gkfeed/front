import type { LiquipediaMatchPreview } from '../../shared/previewContracts.js';
import { isLiquipediaMatchUrl } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchHtml } from './pageFetcher.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';
import type { RequestContext } from '../requestContext.js';

export async function fetchLiquipediaMatch(input: string, context?: RequestContext): Promise<LiquipediaMatchPreview> {
  const url = parsePublicHttpUrl(input);
  if (!isLiquipediaMatchUrl(url)) {
    throw new PreviewError('Only Liquipedia match pages can be previewed', 400, 'invalid_liquipedia_match');
  }

  const page = await fetchHtml(url, undefined, undefined, context);
  const match = parseLiquipediaMatch(page.html, page.url);
  if (!match) {
    throw new PreviewError('The Liquipedia page has no supported match summary', 422, 'match_not_found');
  }
  return match;
}
