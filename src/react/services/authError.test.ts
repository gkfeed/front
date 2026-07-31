import { describe, expect, it } from 'vitest';

import {
  classifyRequestError,
  getRequestErrorMessage,
  isAuthenticationError,
  isNotFoundError,
} from './authError';

function statusError(status: number): Error & { status: number } {
  const error = new Error(`HTTP ${status}`) as Error & { status: number };
  error.status = status;
  return error;
}

describe('request error classification', () => {
  it.each([401, 403])('classifies HTTP %s as authentication', (status) => {
    const error = statusError(status);

    expect(classifyRequestError(error)).toBe('authentication');
    expect(isAuthenticationError(error)).toBe(true);
    expect(isNotFoundError(error)).toBe(false);
    expect(getRequestErrorMessage(error, (key) => key, 'feed.loadError')).toBe('auth.sessionExpired');
  });

  it('keeps HTTP 404 separate from authentication errors', () => {
    const error = statusError(404);

    expect(classifyRequestError(error)).toBe('not-found');
    expect(isAuthenticationError(error)).toBe(false);
    expect(isNotFoundError(error)).toBe(true);
    expect(getRequestErrorMessage(error, (key) => key, 'feed.loadError')).toBe('feed.loadError');
  });

  it('uses the fallback for errors without an HTTP status', () => {
    expect(classifyRequestError(new Error('offline'))).toBe('other');
    expect(getRequestErrorMessage(new Error('offline'), (key) => key, 'feed.loadError')).toBe('feed.loadError');
  });

  it('allows login to use its authentication-specific message', () => {
    expect(getRequestErrorMessage(statusError(401), (key) => key, 'auth.signInError', 'auth.invalidCredentials'))
      .toBe('auth.invalidCredentials');
  });
});
