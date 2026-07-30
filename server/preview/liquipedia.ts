import type { LiquipediaMatchPreview } from '../../shared/previewContracts.js';
import { PreviewError } from './errors.js';
import { parsePublicHttpUrl, safeDecodeURIComponent } from './publicUrlPolicy.js';
import { fetchHtml } from './pageFetcher.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';

export async function fetchLiquipediaMatch(input: string): Promise<LiquipediaMatchPreview> {
  const url = parsePublicHttpUrl(input);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = safeDecodeURIComponent(url.pathname);
  if (hostname !== 'liquipedia.net' || !/\/Match:/i.test(pathname)) {
    throw new PreviewError('Only Liquipedia match pages can be previewed', 400, 'invalid_liquipedia_match');
  }

  const page = await fetchHtml(url);
  const match = parseLiquipediaMatch(page.html, page.url);
  if (!match) {
    throw new PreviewError('The Liquipedia page has no supported match summary', 422, 'match_not_found');
  }
  return match;
}
