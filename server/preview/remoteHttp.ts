import type { PublicHttpResponse } from '../publicHttp.js';
import { PublicHttpError, requestPublicHttp } from '../publicHttp.js';
import { firstHeader } from './bodyReaders.js';
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
): Promise<PublicHttpResponse> {
  let url = input;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let response: PublicHttpResponse;
    try {
      response = await requestPublicHttp(url, {
        accept: options.accept,
        'user-agent': options.userAgent,
      });
    } catch (error) {
      throwPublicUrlError(error);
      throw new PreviewError(
        options.fetchFailedMessage(error instanceof PublicHttpError && error.reason === 'timeout'),
        502,
        options.fetchFailedCode,
      );
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError(options.invalidRedirectMessage, 502, 'invalid_redirect');
      if (redirects === maxRedirects) {
        throw new PreviewError(options.tooManyRedirectsMessage, 502, 'too_many_redirects');
      }
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(
        options.upstreamMessage(response.status),
        502,
        options.upstreamCode ?? 'upstream_error',
      );
    }

    return response;
  }

  throw new PreviewError(options.tooManyRedirectsMessage, 502, 'too_many_redirects');
}

export function throwPublicUrlError(error: unknown): void {
  if (!(error instanceof PublicHttpError)) return;
  if (error.reason === 'private') {
    throw new PreviewError('Private or local network URLs are not allowed', 403, 'private_url');
  }
  if (error.reason === 'unresolvable') {
    throw new PreviewError('The URL hostname could not be resolved', 422, 'unresolvable_host');
  }
}
