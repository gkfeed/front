import { describe, expect, it } from 'vitest';

import { HttpRequestError } from './http/httpErrors.js';
import { toHttpErrorResponse } from './http/httpErrorMapping.js';
import { PreviewError } from './preview/errors.js';

describe('HTTP error mapping', () => {
  it('maps request errors without treating them as provider failures', () => {
    expect(toHttpErrorResponse(new HttpRequestError('Missing URL', 'missing_url', 400))).toEqual({
      status: 400,
      code: 'missing_url',
      message: 'Missing URL',
    });
  });

  it('maps internal provider kinds to public HTTP responses at the boundary', () => {
    const invalidUrl = new PreviewError('Bad URL', 'invalid_url');
    const providerFailure = new PreviewError('Provider failed', 'fetch_failed');

    expect(invalidUrl).not.toHaveProperty('status');
    expect(invalidUrl).not.toHaveProperty('code');
    expect(toHttpErrorResponse(invalidUrl)).toEqual({
      status: 400,
      code: 'invalid_url',
      message: 'Bad URL',
    });
    expect(toHttpErrorResponse(providerFailure)).toEqual({
      status: 502,
      code: 'fetch_failed',
      message: 'Provider failed',
    });
  });

  it('keeps unknown provider reasons safe while preserving the legacy public code', () => {
    expect(toHttpErrorResponse(new PreviewError('Provider failed', 'provider_specific'))).toEqual({
      status: 502,
      code: 'provider_specific',
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
