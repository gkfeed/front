import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { fetchTikTokDetails } from './tiktokDetails.js';
import {
  fetchTikTokJson,
  isRetryableTikTokRequestError,
  isTikTokRequestTimeout,
  type TikTokJsonResult,
} from './tiktokJson.js';
import { parseTikTokComments } from './tiktokCommentParser.js';
import { parseTikTokVideoUrl } from './tiktokUrlParser.js';
import type { TikTokCommentsPreview } from '../shared/tiktokContracts.js';

const COMMENT_LIMIT = 10;
const COMMENT_REQUEST_ATTEMPTS = 2;

export async function fetchTikTokComments(
  input: string,
  context?: RequestExecutionContext,
): Promise<TikTokCommentsPreview> {
  const videoUrl = parseTikTokVideoUrl(input);
  const detailsPromise = fetchTikTokDetails(videoUrl, context);
  const upstream = new URL('https://www.tikwm.com/api/comment/list');
  upstream.searchParams.set('url', videoUrl.href);
  upstream.searchParams.set('count', String(COMMENT_LIMIT));
  upstream.searchParams.set('cursor', '0');

  let body: TikTokJsonResult | null;
  try {
    body = await fetchTikTokCommentsJson(upstream, context);
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = isTikTokRequestTimeout(error)
      ? 'TikTok comments took too long to respond'
      : 'TikTok comments could not be fetched';
    throw new PreviewError(message, 'comments_fetch_failed');
  }

  if (!body) throw new PreviewError('The comments provider returned an error', 'comments_upstream_error');
  return {
    comments: parseTikTokComments(body.value),
    ...await detailsPromise,
  };
}

async function fetchTikTokCommentsJson(
  upstream: URL,
  context?: RequestExecutionContext,
) {
  for (let attempt = 0; attempt < COMMENT_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchTikTokJson(upstream, 'comments', context);
      if (response || attempt === COMMENT_REQUEST_ATTEMPTS - 1) return response;
    } catch (error) {
      if (attempt === COMMENT_REQUEST_ATTEMPTS - 1 || !isRetryableTikTokRequestError(error)) {
        throw error;
      }
    }
  }

  return null;
}
