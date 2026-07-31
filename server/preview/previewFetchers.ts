import { PublicHttpError, type PublicHttpResponse } from '../publicHttp.js';
import {
  MAX_IMAGE_RESPONSE_BYTES,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  fetchPublicResponse,
} from './remoteHttp.js';
import { PreviewError } from './errors.js';
import { firstHeader, readLimitedBody, readLimitedBytes } from './bodyReaders.js';

const MAX_REDIRECTS = 5;
export const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export type PreviewResponse = {
  response: PublicHttpResponse;
  contentType: string;
};

export async function fetchHtmlResponse(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
): Promise<PreviewResponse> {
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
  return { response, contentType };
}

export async function fetchImageResponse(input: URL): Promise<PreviewResponse> {
  const response = await fetchPublicResponse(input, {
    accept: 'image/avif,image/webp,image/jpeg,image/png,image/*',
    userAgent: TWITTERBOT_USER_AGENT,
    invalidRedirectMessage: 'Reddit returned an invalid image redirect',
    tooManyRedirectsMessage: 'Reddit redirected the image too many times',
    upstreamMessage: (status) => `Reddit returned HTTP ${status} for the preview image`,
    upstreamCode: 'image_upstream_error',
    fetchFailedMessage: (timedOut) => timedOut
      ? 'The Reddit preview image took too long to respond'
      : 'The Reddit preview image could not be fetched',
    fetchFailedCode: 'image_fetch_failed',
    maxRedirects: MAX_REDIRECTS,
  });
  const contentType = firstHeader(response.headers['content-type'])
    ?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    response.body.resume();
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
  } = {},
): Promise<string> {
  return readPreviewBody(
    () => readLimitedBody(response, {
      maxBytes: options.maxBytes ?? MAX_RESPONSE_BYTES,
      encoding: options.encoding,
      stopAfterHead: options.stopAfterHead,
      truncateAtLimit: options.truncateAtLimit,
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
): Promise<string> {
  return readHtmlBody(response, {
    maxBytes: MAX_METADATA_RESPONSE_BYTES,
    encoding,
    stopAfterHead: true,
    truncateAtLimit: true,
  });
}

export async function readImageBody(
  response: PublicHttpResponse,
): Promise<Uint8Array> {
  return readPreviewBody(
    () => readLimitedBytes(response, MAX_IMAGE_RESPONSE_BYTES),
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
