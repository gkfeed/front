import { PublicHttpError, type PublicHttpResponse } from '../publicHttp.js';
import {
  MAX_IMAGE_RESPONSE_BYTES,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  fetchPublicResponse,
} from './remoteHttp.js';
import { PreviewError } from './errors.js';
import { discardResponseBody, firstHeader, readLimitedBody, readLimitedBytes } from './bodyReaders.js';
import type { RequestContext } from '../requestContext.js';

const MAX_REDIRECTS = 5;
export const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export type PreviewResponse = {
  response: PublicHttpResponse;
  contentType: string;
};

export async function fetchHtmlResponse(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  context?: RequestContext,
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
    throw new PreviewError('The URL does not point to an HTML page', 422, 'not_html');
  }
  return { response, contentType };
}

export async function fetchImageResponse(input: URL, context?: RequestContext): Promise<PreviewResponse> {
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
    throw new PreviewError('Reddit did not return an image', 502, 'invalid_image');
  }
  return { response, contentType };
}

export async function readHtmlBody(
  response: PublicHttpResponse,
  options: {
    maxBytes?: number;
    encoding?: string;
    stopAfterHead?: boolean;
    truncateAtLimit?: boolean;
    context?: RequestContext;
  } = {},
): Promise<string> {
  return readPreviewBody(
    () => readLimitedBody(response, {
      maxBytes: options.maxBytes ?? MAX_RESPONSE_BYTES,
      encoding: options.encoding,
      stopAfterHead: options.stopAfterHead,
      truncateAtLimit: options.truncateAtLimit,
      context: options.context,
    }),
    {
      timeoutMessage: 'The remote page took too long to respond',
      failureMessage: 'The remote page could not be fetched',
      code: 'fetch_failed',
    },
  );
}

export async function readMetadataBody(
  response: PublicHttpResponse,
  encoding?: string,
  context?: RequestContext,
): Promise<string> {
  return readHtmlBody(response, {
    maxBytes: MAX_METADATA_RESPONSE_BYTES,
    encoding,
    stopAfterHead: true,
    truncateAtLimit: true,
    context,
  });
}

export async function readImageBody(
  response: PublicHttpResponse,
  context?: RequestContext,
): Promise<Uint8Array> {
  return readPreviewBody(
    () => readLimitedBytes(response, MAX_IMAGE_RESPONSE_BYTES, context),
    {
      timeoutMessage: 'The Reddit preview image took too long to respond',
      failureMessage: 'The Reddit preview image could not be fetched',
      code: 'image_fetch_failed',
    },
  );
}

async function readPreviewBody<T>(
  read: () => Promise<T>,
  messages: {
    timeoutMessage: string;
    failureMessage: string;
    code: string;
  },
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? messages.timeoutMessage
      : messages.failureMessage;
    throw new PreviewError(message, 502, messages.code);
  }
}
