import { PublicHttpError } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import {
  MAX_IMAGE_RESPONSE_BYTES,
  fetchPublicResponse,
} from './remoteHttp.js';
import { firstHeader, readLimitedBytes } from './bodyReaders.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';

const MAX_REDIRECTS = 5;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export async function fetchRedditPreviewImage(input: string): Promise<PreviewImage> {
  const url = parsePublicHttpUrl(input);
  if (url.hostname.toLowerCase() !== 'share.redd.it' || !url.pathname.startsWith('/preview/post/')) {
    throw new PreviewError('Only Reddit preview images can be proxied', 400, 'invalid_reddit_preview');
  }

  const response = await fetchPublicResponse(url, {
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

  const contentType = firstHeader(response.headers['content-type'])?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!contentType.startsWith('image/')) {
    response.body.resume();
    throw new PreviewError('Reddit did not return an image', 502, 'invalid_image');
  }

  try {
    return {
      body: await readLimitedBytes(response, MAX_IMAGE_RESPONSE_BYTES),
      contentType,
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? 'The Reddit preview image took too long to respond'
      : 'The Reddit preview image could not be fetched';
    throw new PreviewError(message, 502, 'image_fetch_failed');
  }
}
