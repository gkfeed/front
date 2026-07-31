import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicHttpResponse } from '../publicHttp.js';

const fetchPublicResponse = vi.hoisted(() => vi.fn());
const fetchHltvScorebotSnapshot = vi.hoisted(() => vi.fn());

vi.mock('./remoteHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./remoteHttp.js')>(),
  fetchPublicResponse,
}));
vi.mock('./hltvScorebot.js', () => ({ fetchHltvScorebotSnapshot }));

import { fetchHltvHtml } from './hltvFetcher.js';

beforeEach(() => {
  fetchPublicResponse.mockReset();
  fetchHltvScorebotSnapshot.mockReset();
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
    const response = responseFromBody(Buffer.alloc(2_000_001, 0x61));
    fetchPublicResponse.mockResolvedValue(response);

    await expect(fetchHltvHtml(new URL('https://www.hltv.org/matches/1/example')))
      .rejects.toMatchObject({ code: 'response_too_large', status: 422 });
    expect(response.body.destroyed).toBe(true);
    expect(fetchHltvScorebotSnapshot).not.toHaveBeenCalled();
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
