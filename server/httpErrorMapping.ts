import { HttpRequestError } from './http/httpErrors.js';
import { PreviewError } from './preview/errors.js';

export type HttpErrorResponse = {
  status: number;
  code: string;
  message: string;
};

export function toHttpErrorResponse(error: unknown): HttpErrorResponse {
  if (error instanceof HttpRequestError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof PreviewError) {
    return {
      status: statusForPreviewError(error.kind),
      code: error.kind,
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'internal_error',
    message: 'An unexpected error occurred',
  };
}

const CLIENT_ERROR_KINDS = new Set([
  'invalid_url',
  'invalid_tiktok_url',
  'invalid_reddit_preview',
  'invalid_liquipedia_match',
  'missing_url',
  'invalid_path',
]);

const UNPROCESSABLE_ERROR_KINDS = new Set([
  'not_html',
  'match_not_found',
  'response_too_large',
  'image_too_large',
  'unresolvable_host',
]);

export function statusForPreviewError(kind: string): number {
  if (CLIENT_ERROR_KINDS.has(kind)) return 400;
  if (kind === 'private_url') return 403;
  if (UNPROCESSABLE_ERROR_KINDS.has(kind)) return 422;
  if (kind === 'preview_busy') return 429;
  return 502;
}
