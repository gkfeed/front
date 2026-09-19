import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicHttpResponse } from '../publicHttp.js';

const fetchPublicResponse = vi.hoisted(() => vi.fn());

vi.mock('./remoteHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./remoteHttp.js')>(),
  fetchPublicResponse,
}));

import { fetchLiquipediaMatch } from './liquipedia.js';

beforeEach(() => {
  fetchPublicResponse.mockReset();
});

describe('fetchLiquipediaMatch', () => {
  it('loads match markup through the MediaWiki API', async () => {
    fetchPublicResponse.mockResolvedValue(responseFromJson({
      parse: {
        text: {
          '*': `
            <div class="match-bm"><div class="match-bm-match-header">
              <div class="match-bm-match-header-date">August 20, 2026 - 10:30 CST</div>
              <div class="match-bm-match-header-overview">
                <div class="match-bm-match-header-opponent">
                  <img src="/commons/iw.png">
                  <div class="match-bm-match-header-team-long"><a>Iron Wing</a></div>
                  <div class="match-bm-match-header-team-short"><a>IW</a></div>
                  <div data-label-type="result-loss"></div>
                  <div data-label-type="result-loss"></div>
                </div>
                <div class="match-bm-match-header-result">0 : 2
                  <div class="match-bm-match-header-result-text">finished</div>
                </div>
                <div class="match-bm-match-header-opponent">
                  <span class="team-template-darkmode"><img src="/commons/spirit-dark.png"></span>
                  <div class="match-bm-match-header-team-long"><a>Team Spirit</a></div>
                  <div class="match-bm-match-header-team-short"><a>TSpirit</a></div>
                  <div data-label-type="result-win"></div>
                  <div data-label-type="result-win"></div>
                </div>
              </div>
              <div class="match-bm-match-header-tournament tournament-highlighted-bg">
                <a>The International 2026</a>
              </div>
            </div></div>
          `,
        },
      },
    }));

    await expect(fetchLiquipediaMatch(
      'https://liquipedia.net/dota2/Match:ID_TI2026Main_R01-M001',
    )).resolves.toMatchObject({
      score: ['0', '2'],
      status: 'finished',
      tournament: 'The International 2026',
      teams: [
        { name: 'Iron Wing', shortName: 'IW', results: ['loss', 'loss'] },
        { name: 'Team Spirit', shortName: 'TSpirit', results: ['win', 'win'] },
      ],
    });

    expect(fetchPublicResponse).toHaveBeenCalledWith(
      new URL('https://liquipedia.net/dota2/api.php?action=parse&format=json&page=Match%3AID_TI2026Main_R01-M001&prop=text'),
      expect.objectContaining({
        accept: 'application/json',
        acceptEncoding: 'gzip',
        userAgent: 'GKFeed/1.0 (https://github.com/gkfeed/front)',
      }),
    );
  });
});

function responseFromJson(value: unknown): PublicHttpResponse {
  return {
    body: Readable.from([Buffer.from(JSON.stringify(value))]) as IncomingMessage,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    status: 200,
    url: new URL('https://liquipedia.net/dota2/api.php'),
  };
}
