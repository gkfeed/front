import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp,
}));

import { PublicHttpError } from '../publicHttp.js';
import { fetchPublicResponse } from './remoteHttp.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
});

describe('fetchPublicResponse', () => {
  it('destroys an infinite redirect body instead of draining it', async () => {
    const body = infiniteBody();
    requestPublicHttp.mockResolvedValue(response(302, 'file:///etc/passwd', body));

    await expect(fetchPublicResponse(new URL('https://example.com/'), options()))
      .rejects.toMatchObject({ code: 'invalid_redirect' });
    expect(body.destroyed).toBe(true);
  });

  it('destroys an infinite non-success body before returning the upstream error', async () => {
    const body = infiniteBody();
    requestPublicHttp.mockResolvedValue(response(503, undefined, body));

    await expect(fetchPublicResponse(new URL('https://example.com/'), options()))
      .rejects.toMatchObject({ code: 'upstream_error' });
    expect(body.destroyed).toBe(true);
  });

  it('re-validates every redirect target before requesting it', async () => {
    requestPublicHttp
      .mockResolvedValueOnce(response(302, 'http://127.0.0.1/private'))
      .mockRejectedValueOnce(new PublicHttpError('private'));

    await expect(fetchPublicResponse(new URL('https://example.com/'), options()))
      .rejects.toMatchObject({ code: 'private_url', status: 403 });
    expect(requestPublicHttp).toHaveBeenNthCalledWith(
      2,
      new URL('http://127.0.0.1/private'),
      { accept: 'text/html', 'user-agent': 'test-agent' },
    );
  });

  it('rejects redirects whose target is not a valid HTTP URL', async () => {
    requestPublicHttp.mockResolvedValue(response(302, 'file:///etc/passwd'));

    await expect(fetchPublicResponse(new URL('https://example.com/'), options()))
      .rejects.toMatchObject({ code: 'invalid_redirect', status: 502 });
    expect(requestPublicHttp).toHaveBeenCalledTimes(1);
  });

  it('maps malformed redirect locations to the configured redirect error', async () => {
    requestPublicHttp.mockResolvedValue(response(302, 'https://[invalid-host'));

    await expect(fetchPublicResponse(new URL('https://example.com/'), options()))
      .rejects.toMatchObject({ code: 'invalid_redirect', status: 502 });
  });
});

function response(status: number, location?: string, body = Readable.from([])) {
  return {
    body,
    headers: location ? { location } : {},
    status,
    url: new URL('https://example.com/'),
  };
}

function infiniteBody() {
  return new Readable({
    read() {
      this.push('x');
    },
  });
}

function options() {
  return {
    accept: 'text/html',
    userAgent: 'test-agent',
    invalidRedirectMessage: 'invalid redirect',
    tooManyRedirectsMessage: 'too many redirects',
    upstreamMessage: (status: number) => `upstream ${status}`,
    fetchFailedMessage: () => 'fetch failed',
    fetchFailedCode: 'fetch_failed',
  };
}
