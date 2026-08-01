import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicHttpResponse } from '../publicHttp.js';
import { PreviewError } from './errors.js';

const fetchPublicResponse = vi.hoisted(() => vi.fn());
const fetchHltvScorebotSnapshot = vi.hoisted(() => vi.fn());
const execFile = vi.hoisted(() => vi.fn());
const mkdtemp = vi.hoisted(() => vi.fn());
const readFile = vi.hoisted(() => vi.fn());
const rm = vi.hoisted(() => vi.fn());
const stat = vi.hoisted(() => vi.fn());

vi.mock('./remoteHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./remoteHttp.js')>(),
  fetchPublicResponse,
}));
vi.mock('./hltvScorebot.js', () => ({ fetchHltvScorebotSnapshot }));
vi.mock('node:child_process', () => ({ execFile }));
vi.mock('node:fs/promises', () => ({ mkdtemp, readFile, rm, stat }));
vi.mock('node:os', () => ({ tmpdir: () => '/tmp' }));

import { fetchHltvHtml } from './hltvFetcher.js';

beforeEach(() => {
  fetchPublicResponse.mockReset();
  fetchHltvScorebotSnapshot.mockReset();
  execFile.mockReset();
  mkdtemp.mockReset();
  readFile.mockReset();
  rm.mockReset();
  stat.mockReset();
});

describe('fetchHltvHtml', () => {
  it('uses the public transport and passes response cookies to the scorebot', async () => {
    const requestedUrl = new URL('https://www.hltv.org/matches/1/example');
    const finalUrl = new URL('https://www.hltv.org/matches/1/example?redirected=1');
    const html = `
      <div class="countdown">LIVE</div>
      <div id="scoreboardElement" data-scorebot-id="scorebot-1" data-team1-id="1"
        data-scorebot-url="https://scorebot.hltv.org/socket.io"></div>
    `;
    const response = responseFrom(html, {
      'set-cookie': ['session=abc; Path=/; Secure'],
    });
    response.url = finalUrl;
    fetchPublicResponse.mockResolvedValue(response);
    fetchHltvScorebotSnapshot.mockResolvedValue(null);

    await expect(fetchHltvHtml(requestedUrl)).resolves.toMatchObject({
      html: expect.stringContaining('scoreboardElement'),
      url: finalUrl,
    });

    expect(fetchPublicResponse).toHaveBeenCalledWith(requestedUrl, expect.objectContaining({
      accept: 'text/html,application/xhtml+xml',
      maxRedirects: 5,
    }));
    expect(fetchHltvScorebotSnapshot).toHaveBeenCalledWith(
      html,
      undefined,
      'session=abc',
    );
  });

  it('rejects an oversized response from the stream before consuming it fully', async () => {
    const response = responseFromBody(Buffer.alloc(8_000_001, 0x61));
    fetchPublicResponse.mockResolvedValue(response);

    await expect(fetchHltvHtml(new URL('https://www.hltv.org/matches/1/example')))
      .rejects.toMatchObject({ code: 'response_too_large', status: 422 });
    expect(response.body.destroyed).toBe(true);
    expect(fetchHltvScorebotSnapshot).not.toHaveBeenCalled();
  });

  it('falls back to aria2c when HLTV blocks the public HTTP transport', async () => {
    const requestedUrl = new URL('https://www.hltv.org/matches/1/example');
    const html = '<meta property="og:title" content="Spirit vs FaZe">';
    fetchPublicResponse.mockRejectedValue(new PreviewError(
      'The HLTV page returned HTTP 403',
      502,
      'upstream_error',
    ));
    mkdtemp.mockResolvedValue('/tmp/gkfeed-hltv-test');
    stat.mockResolvedValue({ size: Buffer.byteLength(html) });
    readFile.mockResolvedValue(Buffer.from(html));
    rm.mockResolvedValue(undefined);
    execFile.mockImplementation((_command, _args, _options, callback) => {
      callback(null, '', '');
    });

    await expect(fetchHltvHtml(requestedUrl)).resolves.toMatchObject({ html });

    expect(execFile).toHaveBeenCalledWith(
      'aria2c',
      expect.arrayContaining([
        '--save-cookies',
        '/tmp/gkfeed-hltv-test/cookies.txt',
        requestedUrl.href,
      ]),
      expect.objectContaining({ timeout: 8_000 }),
      expect.any(Function),
    );
    expect(rm).toHaveBeenCalledWith('/tmp/gkfeed-hltv-test', {
      recursive: true,
      force: true,
    });
  });
});

function responseFrom(
  html: string,
  headers: Record<string, string | string[]> = {},
): PublicHttpResponse {
  return responseFromBody(Buffer.from(html), headers);
}

function responseFromBody(
  body: Uint8Array,
  headers: Record<string, string | string[]> = {},
): PublicHttpResponse {
  return {
    body: Readable.from([body]),
    headers,
    status: 200,
    url: new URL('https://www.hltv.org/'),
  };
}
