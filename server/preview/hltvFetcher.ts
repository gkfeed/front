import { PreviewError } from './errors.js';
import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
} from '../../shared/previewContracts.js';
import { parseHltvMatchStatus } from './hltvHtmlParser.js';
import { fetchHltvScorebotSnapshot } from './hltvScorebot.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { readHtmlBody, TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const MAX_HLTV_RESPONSE_BYTES = 2_000_000;

export interface HltvPage {
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
}

export async function fetchHltvHtml(url: URL): Promise<HltvPage> {
  try {
    const response = await fetchPublicResponse(url, {
      accept: 'text/html,application/xhtml+xml',
      userAgent: TWITTERBOT_USER_AGENT,
      invalidRedirectMessage: 'The HLTV page returned an invalid redirect',
      tooManyRedirectsMessage: 'The HLTV page redirected too many times',
      upstreamMessage: (status) => `The HLTV page returned HTTP ${status}`,
      fetchFailedMessage: (timedOut) => timedOut
        ? 'The HLTV page took too long to respond'
        : 'The HLTV page could not be fetched',
      fetchFailedCode: 'fetch_failed',
      maxRedirects: 5,
    });
    const html = await readHtmlBody(response, { maxBytes: MAX_HLTV_RESPONSE_BYTES });
    const scorebot = parseHltvMatchStatus(html) === 'live'
      ? await fetchHltvScorebotSnapshot(
        html,
        undefined,
        getCookieHeader(response.headers['set-cookie']),
      )
      : null;
    return {
      html,
      url: response.url,
      currentMap: scorebot?.currentMap ?? null,
      playerStats: scorebot?.playerStats ?? null,
      teamSides: scorebot?.teamSides ?? null,
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  }
}

function getCookieHeader(setCookie: string[] | undefined): string | undefined {
  const cookies = (setCookie ?? [])
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie.includes('='));
  return cookies.length > 0 ? cookies.join('; ') : undefined;
}
