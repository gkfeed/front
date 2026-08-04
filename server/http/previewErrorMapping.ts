import type { HttpErrorResponse } from './httpErrors.js';
import type { PreviewError } from '../preview/errors.js';

type PreviewHttpMapping = Pick<HttpErrorResponse, 'status' | 'code'>;

const PREVIEW_HTTP_MAPPINGS: Record<string, PreviewHttpMapping> = {
  // Kept for callers that still construct the legacy preview error kinds;
  // HTTP query/path validation now uses HttpRequestError directly.
  missing_url: { status: 400, code: 'missing_url' },
  invalid_path: { status: 400, code: 'invalid_path' },
  invalid_url: { status: 400, code: 'invalid_url' },
  invalid_tiktok_url: { status: 400, code: 'invalid_tiktok_url' },
  invalid_reddit_preview: { status: 400, code: 'invalid_reddit_preview' },
  invalid_liquipedia_match: { status: 400, code: 'invalid_liquipedia_match' },
  not_html: { status: 422, code: 'not_html' },
  match_not_found: { status: 422, code: 'match_not_found' },
  response_too_large: { status: 422, code: 'response_too_large' },
  image_too_large: { status: 422, code: 'image_too_large' },
  unresolvable_host: { status: 422, code: 'unresolvable_host' },
  private_url: { status: 403, code: 'private_url' },
  preview_busy: { status: 429, code: 'preview_busy' },
};

export function toPreviewHttpError(error: PreviewError): HttpErrorResponse {
  const mapping = PREVIEW_HTTP_MAPPINGS[error.kind] ?? {
    status: 502,
    // Keep the existing public code for provider failures not requiring a
    // special HTTP classification.
    code: error.kind,
  };

  return { ...mapping, message: error.message };
}

export function statusForPreviewError(kind: string): number {
  return PREVIEW_HTTP_MAPPINGS[kind]?.status ?? 502;
}
