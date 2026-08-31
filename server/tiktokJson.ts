import { PublicHttpError, discardResponseBody, requestPublicHttp } from './publicHttp.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { readLimitedJson } from './preview/bodyAdapters.js';
import { PreviewError } from './preview/errors.js';

const TIKTOK_HEADERS = {
  accept: 'application/json',
  'user-agent': 'GKFeed/1.0',
};

export type TikTokJsonSource = 'comments' | 'details' | 'oembed';
export type TikTokJsonResult = { value: unknown };

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

export async function fetchTikTokJson(
  upstream: URL,
  source: TikTokJsonSource,
  context?: RequestExecutionContext,
): Promise<TikTokJsonResult | null> {
  const response = await requestPublicHttp(upstream, TIKTOK_HEADERS, context);
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

export function isRetryableTikTokRequestError(error: unknown): boolean {
  return error instanceof PublicHttpError
    && (error.reason === 'network' || error.reason === 'timeout');
}

export function isTikTokRequestTimeout(error: unknown): boolean {
  return error instanceof PublicHttpError && error.reason === 'timeout';
}
