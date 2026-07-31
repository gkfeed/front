import { PublicHttpError } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import {
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  fetchPublicResponse,
} from './remoteHttp.js';
import {
  firstHeader,
  readLimitedBody,
} from './bodyReaders.js';

const MAX_REDIRECTS = 5;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export async function fetchHtml(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  options: { metadataOnly?: boolean } = {},
): Promise<{ html: string; url: URL }> {
  const response = await fetchPublicResponse(input, {
    accept: 'text/html,application/xhtml+xml',
    userAgent,
    invalidRedirectMessage: 'The remote page returned an invalid redirect',
    tooManyRedirectsMessage: 'The remote page redirected too many times',
    upstreamMessage: (status) => `The remote page returned HTTP ${status}`,
    fetchFailedMessage: (timedOut) => timedOut
      ? 'The remote page took too long to respond'
      : 'The remote page could not be fetched',
    fetchFailedCode: 'fetch_failed',
    maxRedirects: MAX_REDIRECTS,
  });

  const contentType = firstHeader(response.headers['content-type'])?.toLowerCase() ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    response.body.resume();
    throw new PreviewError('The URL does not point to an HTML page', 422, 'not_html');
  }

  try {
    const html = await readLimitedBody(response, {
      maxBytes: options.metadataOnly ? MAX_METADATA_RESPONSE_BYTES : MAX_RESPONSE_BYTES,
      encoding: getCharset(contentType),
      stopAfterHead: options.metadataOnly === true,
      truncateAtLimit: options.metadataOnly === true,
    });
    return { html, url: response.url };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? 'The remote page took too long to respond'
      : 'The remote page could not be fetched';
    throw new PreviewError(message, 502, 'fetch_failed');
  }
}

function getCharset(contentType: string): string | undefined {
  const match = contentType.match(/(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}
