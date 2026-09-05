import type { HltvLiveIndex } from '../../shared/previewContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { readHtmlBody } from './previewBodyReaders.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const HLTV_MATCHES_URL = new URL('https://www.hltv.org/matches');

export async function fetchHltvLiveIndex(
  context: RequestExecutionContext,
): Promise<HltvLiveIndex> {
  const response = await fetchPublicResponse(HLTV_MATCHES_URL, {
    accept: 'text/html,application/xhtml+xml',
    userAgent: TWITTERBOT_USER_AGENT,
    invalidRedirectMessage: 'The HLTV matches page returned an invalid redirect',
    tooManyRedirectsMessage: 'The HLTV matches page redirected too many times',
    upstreamMessage: (status) => `The HLTV matches page returned HTTP ${status}`,
    fetchFailedMessage: (timedOut) => timedOut
      ? 'The HLTV matches page took too long to respond'
      : 'The HLTV matches page could not be fetched',
    fetchFailedCode: 'fetch_failed',
    maxRedirects: 5,
  }, context);
  return parseHltvLiveIndex(await readHtmlBody(response, { context }));
}

export function parseHltvLiveIndex(html: string): HltvLiveIndex {
  const eventIds = new Set<string>();
  const liveWrapperPattern = /<div\b(?=[^>]*\bdata-match-id="(\d+)")(?=[^>]*\blive="true")[^>]*>/gi;
  for (const match of html.matchAll(liveWrapperPattern)) eventIds.add(match[1]!);
  return { eventIds: [...eventIds] };
}
