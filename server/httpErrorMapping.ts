import { HttpRequestError, type HttpErrorResponse } from './http/httpErrors.js';
import { toPreviewHttpError } from './http/previewErrorMapping.js';
import { isPreviewError } from './preview/errors.js';

export type { HttpErrorResponse } from './http/httpErrors.js';

export function toHttpErrorResponse(error: unknown): HttpErrorResponse {
  if (error instanceof HttpRequestError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }

  if (isPreviewError(error)) return toPreviewHttpError(error);

  return {
    status: 500,
    code: 'internal_error',
    message: 'An unexpected error occurred',
  };
}

export { statusForPreviewError } from './http/previewErrorMapping.js';
