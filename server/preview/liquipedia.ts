import type { LiquipediaMatchPreview } from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import { isLiquipediaMatchUrl } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { readLimitedJson } from './bodyAdapters.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { parsePublicHttpUrl, safeDecodeURIComponent } from './publicUrlPolicy.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

const MAX_API_RESPONSE_BYTES = 1_000_000;
const LIQUIPEDIA_USER_AGENT = 'GKFeed/1.0 (https://github.com/gkfeed/front)';

export async function fetchLiquipediaMatch(input: string, context?: RequestExecutionContext): Promise<LiquipediaMatchPreview> {
  const url = parsePublicHttpUrl(input);
  if (!isLiquipediaMatchUrl(url)) {
    throw new PreviewError('Only Liquipedia match pages can be previewed', 'invalid_liquipedia_match');
  }

  const html = await fetchLiquipediaParseHtml(url, context);
  const match = parseLiquipediaMatch(html, url);
  if (!match) {
    throw new PreviewError('The Liquipedia page has no supported match summary', 'match_not_found');
  }
  return match;
}

async function fetchLiquipediaParseHtml(
  pageUrl: URL,
  context?: RequestExecutionContext,
): Promise<string> {
  const pathParts = pageUrl.pathname.split('/').filter(Boolean);
  const wiki = pathParts.shift();
  const page = safeDecodeURIComponent(pathParts.join('/'));
  if (!wiki || !page) {
    throw new PreviewError('Only Liquipedia match pages can be previewed', 'invalid_liquipedia_match');
  }

  const apiUrl = new URL(`/${wiki}/api.php`, pageUrl.origin);
  apiUrl.search = new URLSearchParams({
    action: 'parse',
    format: 'json',
    page,
    prop: 'text',
  }).toString();
  const options = {
    accept: 'application/json',
    acceptEncoding: 'gzip',
    userAgent: LIQUIPEDIA_USER_AGENT,
    invalidRedirectMessage: 'Liquipedia returned an invalid redirect',
    tooManyRedirectsMessage: 'Liquipedia redirected too many times',
    upstreamMessage: (status: number) => `Liquipedia returned HTTP ${status}`,
    fetchFailedMessage: (timedOut: boolean) => timedOut
      ? 'Liquipedia took too long to respond'
      : 'Liquipedia could not be fetched',
    fetchFailedCode: 'fetch_failed',
    maxRedirects: 5,
  };
  const response = context
    ? await fetchPublicResponse(apiUrl, options, context)
    : await fetchPublicResponse(apiUrl, options);
  const payload = await readLimitedJson(response, {
    maximumBytes: MAX_API_RESPONSE_BYTES,
    tooLarge: () => new PreviewError('The Liquipedia response is too large', 'response_too_large'),
    invalidJson: () => new PreviewError('Liquipedia returned invalid data', 'fetch_failed'),
    context,
  });
  if (!isRecord(payload) || !isRecord(payload.parse) || !isRecord(payload.parse.text)) return '';
  const html = payload.parse.text['*'];
  return typeof html === 'string' ? html : '';
}
