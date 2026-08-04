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
import type { RequestContext } from './requestContext.js';
import { discardResponseBody } from './publicHttp.js';

const COMMENT_LIMIT = 10;
const TIKTOK_HEADERS = {
  accept: 'application/json',
  'user-agent': 'GKFeed/1.0',
};

type TikTokJsonSource = 'comments' | 'details' | 'oembed';
type TikTokJsonResult = { value: unknown };

const TIKTOK_JSON_ERRORS: Record<TikTokJsonSource, {
  tooLarge: () => PreviewError;
  invalidJson: () => PreviewError;
}> = {
  comments: {
    tooLarge: () => new PreviewError(
      'The comments response was too large',
      'comments_too_large',
    ),
    invalidJson: () => new PreviewError(
      'The comments provider returned invalid data',
      'invalid_comments',
    ),
  },
  details: {
    tooLarge: () => new PreviewError(
      'The TikTok details response was too large',
      'details_too_large',
    ),
    invalidJson: () => new PreviewError(
      'The TikTok details provider returned invalid data',
      'invalid_details',
    ),
  },
  oembed: {
    tooLarge: () => new PreviewError(
      'The TikTok oEmbed response was too large',
      'oembed_too_large',
    ),
    invalidJson: () => new PreviewError(
      'The TikTok oEmbed provider returned invalid data',
      'invalid_oembed',
    ),
  },
};

export type { TikTokComment } from './tiktokParser.js';
export {
  parseTikTokComments,
  parseTikTokDescription,
  parseTikTokDetails,
  parseTikTokVideoUrl,
} from './tiktokParser.js';

export async function fetchTikTokComments(
  input: string,
  context?: RequestContext,
): Promise<{ comments: TikTokComment[] } & TikTokDetails> {
  const videoUrl = parseTikTokVideoUrl(input);
  const detailsPromise = fetchTikTokDetails(videoUrl, context);
  const upstream = new URL('https://www.tikwm.com/api/comment/list');
  upstream.searchParams.set('url', videoUrl.href);
  upstream.searchParams.set('count', String(COMMENT_LIMIT));
  upstream.searchParams.set('cursor', '0');

  let body: TikTokJsonResult | null;
  try {
    body = await fetchTikTokJson(upstream, 'comments', context);
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
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

async function fetchTikTokDetails(videoUrl: URL, context?: RequestContext): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await fetchTikTokJson(upstream, 'details', context);
    if (response) {
      const details = parseTikTokDetails(response.value);
      if (details) return details;
    }
  } catch {
    // Fall through to TikTok's official oEmbed metadata.
  }

  return fetchTikTokOEmbedDetails(videoUrl, context);
}

async function fetchTikTokOEmbedDetails(videoUrl: URL, context?: RequestContext): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tiktok.com/oembed');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await fetchTikTokJson(upstream, 'oembed', context);
    return response ? parseTikTokOEmbedDetails(response.value) : emptyTikTokDetails();
  } catch {
    return emptyTikTokDetails();
  }
}

async function fetchTikTokJson(
  upstream: URL,
  source: TikTokJsonSource,
  context?: RequestContext,
): Promise<TikTokJsonResult | null> {
  const response = await requestPublicHttp(upstream, TIKTOK_HEADERS, context);
  return readTikTokJsonResponse(response, source, context);
}

async function readTikTokJsonResponse(
  response: Awaited<ReturnType<typeof requestPublicHttp>>,
  source: TikTokJsonSource,
  context?: RequestContext,
): Promise<TikTokJsonResult | null> {
  if (response.status < 200 || response.status >= 300) {
    discardResponseBody(response.body);
    return null;
  }

  return {
    value: await readLimitedJson(response, {
      maximumBytes: 1_000_000,
      ...TIKTOK_JSON_ERRORS[source],
      context,
    }),
  };
}
