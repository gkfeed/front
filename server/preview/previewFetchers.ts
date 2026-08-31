import { discardResponseBody, type PublicHttpResponse } from '../publicHttp.js';
import { fetchPublicResponse } from './remoteHttp.js';
import { PreviewError } from './errors.js';
import { firstHeader } from './headers.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export {
  readHtmlBody,
  readImageBody,
  readMetadataBody,
} from './previewBodyReaders.js';

const MAX_REDIRECTS = 5;
export const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export type PreviewResponse = {
  response: PublicHttpResponse;
  contentType: string;
};

export async function fetchHtmlResponse(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  context?: RequestExecutionContext,
): Promise<PreviewResponse> {
  const requestOptions = {
    accept: 'text/html,application/xhtml+xml',
    userAgent,
    invalidRedirectMessage: 'The remote page returned an invalid redirect',
    tooManyRedirectsMessage: 'The remote page redirected too many times',
    upstreamMessage: (status: number) => `The remote page returned HTTP ${status}`,
    fetchFailedMessage: (timedOut: boolean) => timedOut
      ? 'The remote page took too long to respond'
      : 'The remote page could not be fetched',
    fetchFailedCode: 'fetch_failed',
    maxRedirects: MAX_REDIRECTS,
  };
  const response = context
    ? await fetchPublicResponse(input, requestOptions, context)
    : await fetchPublicResponse(input, requestOptions);
  const contentType = firstHeader(response.headers['content-type'])?.toLowerCase() ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    discardResponseBody(response.body);
    throw new PreviewError('The URL does not point to an HTML page', 'not_html');
  }
  return { response, contentType };
}

export async function fetchImageResponse(input: URL, context?: RequestExecutionContext): Promise<PreviewResponse> {
  const requestOptions = {
    accept: 'image/avif,image/webp,image/jpeg,image/png,image/*',
    userAgent: TWITTERBOT_USER_AGENT,
    invalidRedirectMessage: 'Reddit returned an invalid image redirect',
    tooManyRedirectsMessage: 'Reddit redirected the image too many times',
    upstreamMessage: (status: number) => `Reddit returned HTTP ${status} for the preview image`,
    upstreamCode: 'image_upstream_error',
    fetchFailedMessage: (timedOut: boolean) => timedOut
      ? 'The Reddit preview image took too long to respond'
      : 'The Reddit preview image could not be fetched',
    fetchFailedCode: 'image_fetch_failed',
    maxRedirects: MAX_REDIRECTS,
  };
  const response = context
    ? await fetchPublicResponse(input, requestOptions, context)
    : await fetchPublicResponse(input, requestOptions);
  const contentType = firstHeader(response.headers['content-type'])
    ?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    discardResponseBody(response.body);
    throw new PreviewError('Reddit did not return an image', 'invalid_image');
  }
  return { response, contentType };
}
