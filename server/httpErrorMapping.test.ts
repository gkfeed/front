import { describe, expect, it } from 'vitest';

import { toHttpErrorResponse } from './httpErrorMapping.js';
import { PreviewError } from './preview/errors.js';

describe('HTTP error mapping', () => {
  it('maps internal provider kinds to public HTTP responses at the boundary', () => {
    expect(toHttpErrorResponse(new PreviewError('Bad URL', 'invalid_url'))).toEqual({
      status: 400,
      code: 'invalid_url',
      message: 'Bad URL',
    });
    expect(toHttpErrorResponse(new PreviewError('Provider failed', 'fetch_failed'))).toEqual({
      status: 502,
      code: 'fetch_failed',
      message: 'Provider failed',
    });
  });

  it('does not expose unexpected error details', () => {
    expect(toHttpErrorResponse(new Error('database password'))).toEqual({
      status: 500,
      code: 'internal_error',
      message: 'An unexpected error occurred',
    });
  });
});
