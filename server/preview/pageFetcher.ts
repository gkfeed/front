import { PublicHttpError, requestPublicHttp } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import {
  firstHeader,
  isRedirect,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  parsePublicHttpUrl,
  readLimitedBody,
  throwPublicUrlError,
} from './remoteHttp.js';

const MAX_REDIRECTS = 5;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export async function fetchHtml(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  options: { metadataOnly?: boolean } = {},
): Promise<{ html: string; url: URL }> {
  let url = input;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Awaited<ReturnType<typeof requestPublicHttp>>;
    try {
      response = await requestPublicHttp(url, {
        accept: 'text/html,application/xhtml+xml',
        // This is the request profile gkbot uses for feed previews. A number
        // of social sites only include their media metadata for crawler UAs.
        'user-agent': userAgent,
      });
    } catch (error) {
      throwPublicUrlError(error);
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The remote page took too long to respond'
        : 'The remote page could not be fetched';
      throw new PreviewError(message, 502, 'fetch_failed');
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError('The remote page returned an invalid redirect', 502, 'invalid_redirect');
      if (redirects === MAX_REDIRECTS) throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(`The remote page returned HTTP ${response.status}`, 502, 'upstream_error');
    }

    const contentType = firstHeader(response.headers['content-type'])?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      response.body.resume();
      throw new PreviewError('The URL does not point to an HTML page', 422, 'not_html');
    }

    try {
      const html = await readLimitedBody(response, {
        maxBytes: options.metadataOnly ? MAX_METADATA_RESPONSE_BYTES : MAX_RESPONSE_BYTES,
        stopAfterHead: options.metadataOnly === true,
        truncateAtLimit: options.metadataOnly === true,
      });
      return { html, url };
    } catch (error) {
      if (error instanceof PreviewError) throw error;
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The remote page took too long to respond'
        : 'The remote page could not be fetched';
      throw new PreviewError(message, 502, 'fetch_failed');
    }
  }

  throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
}
