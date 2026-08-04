import { PreviewError } from './errors.js';
import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { parseHltvMatchStatus } from './hltvHtmlParser.js';
import { fetchHltvScorebotSnapshot } from './hltvScorebot.js';
import {
  fetchHltvPageViaAria2c,
  fetchHltvPageViaPublicHttp,
  type HltvRawPage,
} from './hltvTransport.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export interface HltvPage {
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
  roundHistory: HltvRoundPreview[] | null;
}

export async function fetchHltvHtml(url: URL, context?: RequestExecutionContext): Promise<HltvPage> {
  try {
    return await fetchHltvHtmlWithPublicHttp(url, context);
  } catch (error) {
    if (isHltvAccessDenied(error)) {
      return fetchHltvHtmlWithAria2c(url, context);
    }
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 'fetch_failed');
  }
}

async function fetchHltvHtmlWithPublicHttp(url: URL, context?: RequestExecutionContext): Promise<HltvPage> {
  return enrichHltvPage(await fetchHltvPageViaPublicHttp(url, context), context);
}

async function fetchHltvHtmlWithAria2c(url: URL, context?: RequestExecutionContext): Promise<HltvPage> {
  return enrichHltvPage(await fetchHltvPageViaAria2c(url, context), context);
}

async function enrichHltvPage(page: HltvRawPage, context?: RequestExecutionContext): Promise<HltvPage> {
  try {
    const scorebot = parseHltvMatchStatus(page.html) === 'live'
      ? context
        ? await fetchHltvScorebotSnapshot(
          page.html,
          page.cookiesPath,
          page.cookieHeader,
          context,
        )
        : await fetchHltvScorebotSnapshot(page.html, page.cookiesPath, page.cookieHeader)
      : null;
    return {
      html: page.html,
      url: page.url,
      currentMap: scorebot?.currentMap ?? null,
      playerStats: scorebot?.playerStats ?? null,
      teamSides: scorebot?.teamSides ?? null,
      roundHistory: scorebot ? scorebot.roundHistory ?? [] : null,
    };
  } finally {
    await page.cleanup();
  }
}

function isHltvAccessDenied(error: unknown): boolean {
  return error instanceof PreviewError
    && error.kind === 'upstream_error'
    && /\bHTTP 403\b/.test(error.message);
}
