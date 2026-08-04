import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { REMOTE_REQUEST_TIMEOUT_MS } from '../timeouts.js';
import { responseTooLarge } from './bodyReaders.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { readHtmlBody, TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import { PreviewError } from './errors.js';
import type { RequestContext } from '../requestContext.js';

// HLTV match pages include a long history/stats section and are commonly
// larger than the generic preview limit.
export const MAX_HLTV_RESPONSE_BYTES = 8_000_000;

const execFileAsync = promisify(execFile);

export interface HltvRawPage {
  html: string;
  url: URL;
  cookieHeader?: string;
  cookiesPath?: string;
  cleanup: () => Promise<void>;
}

export async function fetchHltvPageViaPublicHttp(
  url: URL,
  context?: RequestContext,
): Promise<HltvRawPage> {
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

  return {
    html,
    url: response.url,
    cookieHeader: getCookieHeader(response.headers['set-cookie']),
    cleanup: async () => {},
  };
}

export async function fetchHltvPageViaAria2c(
  url: URL,
  context?: RequestContext,
): Promise<HltvRawPage> {
  const directory = await mkdtemp(join(tmpdir(), 'gkfeed-hltv-'));
  const output = join(directory, 'response');
  const cookies = join(directory, 'cookies.txt');
  let keepDirectory = false;

  try {
    const timeoutMs = context?.remainingMs(REMOTE_REQUEST_TIMEOUT_MS) ?? REMOTE_REQUEST_TIMEOUT_MS;
    if (timeoutMs <= 0 || context?.signal.aborted) {
      throw new PreviewError('The HLTV page took too long to respond', 'fetch_failed');
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
    keepDirectory = true;
    return {
      html,
      url,
      cookiesPath: cookies,
      cleanup: async () => {
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 'fetch_failed');
  } finally {
    if (!keepDirectory) await rm(directory, { recursive: true, force: true });
  }
}

function getCookieHeader(setCookie: string[] | undefined): string | undefined {
  const cookies = (setCookie ?? [])
    .map((cookie) => cookie.split(';', 1)[0])
    .filter((cookie) => cookie.includes('='));
  return cookies.length > 0 ? cookies.join('; ') : undefined;
}
