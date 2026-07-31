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

function response(status: number, location?: string) {
  return {
    body: Readable.from([]),
    headers: location ? { location } : {},
    status,
    url: new URL('https://example.com/'),
  };
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
