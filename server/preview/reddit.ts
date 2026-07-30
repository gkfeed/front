import { PublicHttpError, requestPublicHttp } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import {
  firstHeader,
  isRedirect,
  MAX_IMAGE_RESPONSE_BYTES,
  parsePublicHttpUrl,
  readLimitedBytes,
  throwPublicUrlError,
} from './remoteHttp.js';

const MAX_REDIRECTS = 5;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export async function fetchRedditPreviewImage(input: string): Promise<PreviewImage> {
  let url = parsePublicHttpUrl(input);
  if (url.hostname.toLowerCase() !== 'share.redd.it' || !url.pathname.startsWith('/preview/post/')) {
    throw new PreviewError('Only Reddit preview images can be proxied', 400, 'invalid_reddit_preview');
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Awaited<ReturnType<typeof requestPublicHttp>>;
    try {
      response = await requestPublicHttp(url, {
        accept: 'image/avif,image/webp,image/jpeg,image/png,image/*',
        'user-agent': TWITTERBOT_USER_AGENT,
      });
    } catch (error) {
      throwPublicUrlError(error);
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The Reddit preview image took too long to respond'
        : 'The Reddit preview image could not be fetched';
      throw new PreviewError(message, 502, 'image_fetch_failed');
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError('Reddit returned an invalid image redirect', 502, 'invalid_redirect');
      if (redirects === MAX_REDIRECTS) throw new PreviewError('Reddit redirected the image too many times', 502, 'too_many_redirects');
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(`Reddit returned HTTP ${response.status} for the preview image`, 502, 'image_upstream_error');
    }

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

  throw new PreviewError('Reddit redirected the image too many times', 502, 'too_many_redirects');
}
