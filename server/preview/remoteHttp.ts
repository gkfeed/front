import type { PublicHttpResponse } from '../publicHttp.js';
import { PublicHttpError, requestPublicHttp } from '../publicHttp.js';
import type { RequestContext } from '../requestContext.js';
import { discardResponseBody, firstHeader } from './bodyReaders.js';
import { PreviewError } from './errors.js';
import { isRedirect, parsePublicHttpUrl } from './publicUrlPolicy.js';

const DEFAULT_MAX_REDIRECTS = 5;

export {
  MAX_IMAGE_RESPONSE_BYTES,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  firstHeader,
  readLimitedBody,
  readLimitedBytes,
  readLimitedJson,
  responseTooLarge,
} from './bodyReaders.js';
export { isRedirect, parsePublicHttpUrl, safeDecodeURIComponent } from './publicUrlPolicy.js';

export interface PublicResponseOptions {
  accept: string;
  userAgent: string;
  invalidRedirectMessage: string;
  tooManyRedirectsMessage: string;
  upstreamMessage: (status: number) => string;
  upstreamCode?: string;
  fetchFailedMessage: (timedOut: boolean) => string;
  fetchFailedCode: string;
  maxRedirects?: number;
}

export async function fetchPublicResponse(
  input: URL,
  options: PublicResponseOptions,
  context?: RequestContext,
): Promise<PublicHttpResponse> {
  let url = input;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let response: PublicHttpResponse;
    try {
      const headers = {
        accept: options.accept,
        'user-agent': options.userAgent,
      };
      response = context
        ? await requestPublicHttp(url, headers, context)
        : await requestPublicHttp(url, headers);
    } catch (error) {
      throwPublicUrlError(error);
      throw new PreviewError(
        options.fetchFailedMessage(error instanceof PublicHttpError && error.reason === 'timeout'),
        options.fetchFailedCode,
      );
    }

    if (isRedirect(response.status)) {
      discardResponseBody(response.body);
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError(options.invalidRedirectMessage, 'invalid_redirect');
      if (redirects === maxRedirects) {
        throw new PreviewError(options.tooManyRedirectsMessage, 'too_many_redirects');
      }
      let redirectedUrl: URL;
      try {
        redirectedUrl = new URL(location, url);
      } catch {
        throw new PreviewError(options.invalidRedirectMessage, 'invalid_redirect');
      }
      try {
        url = parsePublicHttpUrl(redirectedUrl.href);
      } catch (error) {
        if (error instanceof PreviewError && error.kind === 'invalid_url') {
          throw new PreviewError(options.invalidRedirectMessage, 'invalid_redirect');
        }
        throw error;
      }
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      discardResponseBody(response.body);
      throw new PreviewError(
        options.upstreamMessage(response.status),
        options.upstreamCode ?? 'upstream_error',
      );
    }

    return response;
  }

  throw new PreviewError(options.tooManyRedirectsMessage, 'too_many_redirects');
}

export function throwPublicUrlError(error: unknown): void {
  if (!(error instanceof PublicHttpError)) return;
  if (error.reason === 'private') {
    throw new PreviewError('Private or local network URLs are not allowed', 'private_url');
  }
  if (error.reason === 'unresolvable') {
    throw new PreviewError('The URL hostname could not be resolved', 'unresolvable_host');
  }
}
