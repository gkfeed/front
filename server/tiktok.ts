import { PublicHttpError, requestPublicHttp } from './publicHttp.js';
import { PreviewError } from './preview/errors.js';
import { readLimitedJson } from './preview/bodyReaders.js';
import {
  emptyTikTokDetails,
  parseTikTokComments,
  parseTikTokDetails,
  parseTikTokOEmbedDetails,
  parseTikTokVideoUrl,
  type TikTokComment,
  type TikTokDetails,
} from './tiktokParser.js';

const COMMENT_LIMIT = 10;

export type { TikTokComment } from './tiktokParser.js';
export {
  parseTikTokComments,
  parseTikTokDescription,
  parseTikTokDetails,
  parseTikTokVideoUrl,
} from './tiktokParser.js';

export async function fetchTikTokComments(
  input: string,
): Promise<{ comments: TikTokComment[] } & TikTokDetails> {
  const videoUrl = parseTikTokVideoUrl(input);
  const detailsPromise = fetchTikTokDetails(videoUrl);
  const upstream = new URL('https://www.tikwm.com/api/comment/list');
  upstream.searchParams.set('url', videoUrl.href);
  upstream.searchParams.set('count', String(COMMENT_LIMIT));
  upstream.searchParams.set('cursor', '0');

  let response: Awaited<ReturnType<typeof requestPublicHttp>>;
  try {
    response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
  } catch (error) {
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? 'TikTok comments took too long to respond'
      : 'TikTok comments could not be fetched';
    throw new PreviewError(message, 502, 'comments_fetch_failed');
  }

  if (response.status < 200 || response.status >= 300) {
    response.body.resume();
    throw new PreviewError('The comments provider returned an error', 502, 'comments_upstream_error');
  }

  const body = await readTikTokJson(response);
  return {
    comments: parseTikTokComments(body),
    ...await detailsPromise,
  };
}

async function fetchTikTokDetails(videoUrl: URL): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
    if (response.status >= 200 && response.status < 300) {
      const details = parseTikTokDetails(await readTikTokJson(response));
      if (details) return details;
    } else {
      response.body.resume();
    }
  } catch {
    // Fall through to TikTok's official oEmbed metadata.
  }

  return fetchTikTokOEmbedDetails(videoUrl);
}

async function fetchTikTokOEmbedDetails(videoUrl: URL): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tiktok.com/oembed');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      return emptyTikTokDetails();
    }
    const value = await readTikTokJson(response);
    return parseTikTokOEmbedDetails(value);
  } catch {
    return emptyTikTokDetails();
  }
}

async function readTikTokJson(
  response: Awaited<ReturnType<typeof requestPublicHttp>>,
): Promise<unknown> {
  return readLimitedJson(response, {
    maximumBytes: 1_000_000,
    tooLarge: () => new PreviewError(
      'The comments response was too large',
      502,
      'comments_too_large',
    ),
    invalidJson: () => new PreviewError(
      'The comments provider returned invalid data',
      502,
      'invalid_comments',
    ),
  });
}
