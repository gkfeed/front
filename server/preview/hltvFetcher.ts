import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PreviewError } from './errors.js';
import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { REMOTE_REQUEST_TIMEOUT_MS } from '../timeouts.js';
import { responseTooLarge } from './bodyReaders.js';
import { parseHltvMatchStatus } from './hltvHtmlParser.js';
import { fetchHltvScorebotSnapshot } from './hltvScorebot.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { readHtmlBody, TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import type { RequestContext } from '../requestContext.js';

// HLTV match pages include a long history/stats section and are commonly
// larger than the generic preview limit.
const MAX_HLTV_RESPONSE_BYTES = 8_000_000;
const execFileAsync = promisify(execFile);

export interface HltvPage {
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
  roundHistory: HltvRoundPreview[] | null;
}

export async function fetchHltvHtml(url: URL, context?: RequestContext): Promise<HltvPage> {
  try {
    return await fetchHltvHtmlWithPublicHttp(url, context);
  } catch (error) {
    if (isHltvAccessDenied(error)) {
      return fetchHltvHtmlWithAria2c(url, context);
    }
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  }
}

async function fetchHltvHtmlWithPublicHttp(url: URL, context?: RequestContext): Promise<HltvPage> {
  const requestOptions = {
    accept: 'text/html,application/xhtml+xml',
    userAgent: TWITTERBOT_USER_AGENT,
    invalidRedirectMessage: 'The HLTV page returned an invalid redirect',
    tooManyRedirectsMessage: 'The HLTV page redirected too many times',
    upstreamMessage: (status: number) => `The HLTV page returned HTTP ${status}`,
    fetchFailedMessage: (timedOut: boolean) => timedOut
      ? 'The HLTV page took too long to respond'
      : 'The HLTV page could not be fetched',
    fetchFailedCode: 'fetch_failed',
    maxRedirects: 5,
  };
  const response = context
    ? await fetchPublicResponse(url, requestOptions, context)
    : await fetchPublicResponse(url, requestOptions);
  const html = await readHtmlBody(response, { maxBytes: MAX_HLTV_RESPONSE_BYTES, context });
  const scorebot = parseHltvMatchStatus(html) === 'live'
    ? context
      ? await fetchHltvScorebotSnapshot(
        html,
        undefined,
        getCookieHeader(response.headers['set-cookie']),
        context,
      )
      : await fetchHltvScorebotSnapshot(
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
    roundHistory: scorebot ? scorebot.roundHistory ?? [] : null,
  };
}

async function fetchHltvHtmlWithAria2c(url: URL, context?: RequestContext): Promise<HltvPage> {
  const directory = await mkdtemp(join(tmpdir(), 'gkfeed-hltv-'));
  const output = join(directory, 'response');
  const cookies = join(directory, 'cookies.txt');
  try {
    const timeoutMs = context?.remainingMs(REMOTE_REQUEST_TIMEOUT_MS) ?? REMOTE_REQUEST_TIMEOUT_MS;
    if (timeoutMs <= 0 || context?.signal.aborted) {
      throw new PreviewError('The HLTV page took too long to respond', 502, 'fetch_failed');
    }
    await execFileAsync('aria2c', [
      '--quiet=true',
      '--allow-overwrite=true',
      '--auto-file-renaming=false',
      '--max-tries=1',
      '--connect-timeout=8',
      '--timeout=8',
      '--save-cookies',
      cookies,
      '--header',
      `User-Agent: ${TWITTERBOT_USER_AGENT}`,
      '--dir',
      directory,
      '--out',
      'response',
      url.href,
    ], {
      timeout: timeoutMs,
      signal: context?.signal,
    });

    if ((await stat(output)).size > MAX_HLTV_RESPONSE_BYTES) throw responseTooLarge();
    const html = (await readFile(output)).toString('utf8');
    const scorebot = parseHltvMatchStatus(html) === 'live'
      ? await fetchHltvScorebotSnapshot(html, cookies, undefined, context)
      : null;
    return {
      html,
      url,
      currentMap: scorebot?.currentMap ?? null,
      playerStats: scorebot?.playerStats ?? null,
      teamSides: scorebot?.teamSides ?? null,
      roundHistory: scorebot ? scorebot.roundHistory ?? [] : null,
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function isHltvAccessDenied(error: unknown): boolean {
  return error instanceof PreviewError
    && error.code === 'upstream_error'
    && error.status === 502
    && /\bHTTP 403\b/.test(error.message);
}

function getCookieHeader(setCookie: string[] | undefined): string | undefined {
  const cookies = (setCookie ?? [])
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie.includes('='));
  return cookies.length > 0 ? cookies.join('; ') : undefined;
}
