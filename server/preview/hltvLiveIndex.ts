import type { HltvLiveIndex } from '../../shared/previewContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { fetchHltvHtml } from './hltvFetcher.js';

const HLTV_MATCHES_URL = new URL('https://www.hltv.org/matches');

export async function fetchHltvLiveIndex(
  context: RequestExecutionContext,
): Promise<HltvLiveIndex> {
  const page = await fetchHltvHtml(HLTV_MATCHES_URL, context);
  return parseHltvLiveIndex(page.html);
}

export function parseHltvLiveIndex(html: string): HltvLiveIndex {
  const eventIds = new Set<string>();
  const liveWrapperPattern = /<div\b(?=[^>]*\bdata-match-id="(\d+)")(?=[^>]*\blive="true")[^>]*>/gi;
  for (const match of html.matchAll(liveWrapperPattern)) eventIds.add(match[1]!);
  return { eventIds: [...eventIds] };
}
