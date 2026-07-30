import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('./publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./publicHttp.js')>(),
  requestPublicHttp,
}));

import {
  fetchOpenGraph,
  fetchRedditPreviewImage,
  parseLiquipediaMatch,
  parseOpenGraph,
} from './opengraph.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
});

describe('parseOpenGraph', () => {
  it('extracts Open Graph metadata regardless of attribute order', () => {
    const html = `
      <html><head>
        <meta content="Example &amp; Sons" property="og:title">
        <meta property='og:description' content='A useful preview'>
        <meta content="/cover.jpg" property="og:image">
        <meta property="og:site_name" content="Example">
        <meta property="og:type" content="article">
      </head></html>`;

    expect(parseOpenGraph(html, new URL('https://example.com/posts/1'))).toEqual({
      url: 'https://example.com/posts/1',
      title: 'Example & Sons',
      description: 'A useful preview',
      image: 'https://example.com/cover.jpg',
      video: null,
      siteName: 'Example',
      type: 'article',
      matchStartsAt: null,
    });
  });

  it('extracts the scheduled start from an HLTV match page', () => {
    const html = `
      <meta property="og:title" content="Liquid vs Spirit">
      <div class="timeAndEvent">
        <div class="time" data-time-format="HH:mm" data-unix="1784829900000">20:05</div>
        <div class="date" data-unix="1784829900000">23rd of July 2026</div>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://www.hltv.org/matches/2396006/liquid-vs-spirit'),
    ).matchStartsAt).toBe('2026-07-23T18:05:00.000Z');
  });

  it('falls back to standard title and description metadata', () => {
    const html = '<title>Fallback title</title><meta name="description" content="Fallback description">';

    expect(parseOpenGraph(html, new URL('https://example.com')).title).toBe('Fallback title');
    expect(parseOpenGraph(html, new URL('https://example.com')).description).toBe('Fallback description');
  });

  it('rejects non-http image URLs', () => {
    const html = '<meta property="og:image" content="javascript:alert(1)">';
    expect(parseOpenGraph(html, new URL('https://example.com')).image).toBeNull();
  });

  it('uses the Twitter metadata fallbacks supported by gkbot', () => {
    const html = `
      <meta name="twitter:title" content="Social title">
      <meta name="twitter:description" content="Social description">
      <meta name="twitter:image" value="/social.jpg">
      <meta name="twitter:player:stream" content="/clip.mp4">
    `;

    expect(parseOpenGraph(html, new URL('https://example.com/post'))).toMatchObject({
      title: 'Social title',
      description: 'Social description',
      image: 'https://example.com/social.jpg',
      video: 'https://example.com/clip.mp4',
    });
  });
});

describe('fetchOpenGraph', () => {
  it('uses the Rezka preview host and crawler profile used by gkbot', async () => {
    requestPublicHttp.mockImplementation(async (url: URL) => ({
      body: Readable.from([
        gzipSync('<meta property="og:image" content="/covers/story.jpg">'),
      ]),
      headers: {
        'content-encoding': 'gzip',
        'content-type': 'text/html; charset=utf-8',
      },
      status: 200,
      url,
    }));

    await expect(fetchOpenGraph('https://hdrezka.me/films/drama/123-story.html'))
      .resolves.toMatchObject({
        image: 'https://rezka.ag/covers/story.jpg',
        url: 'https://rezka.ag/films/drama/123-story.html',
      });
    expect(requestPublicHttp).toHaveBeenCalledWith(
      new URL('https://rezka.ag/films/drama/123-story.html'),
      {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'TelegramBot (like TwitterBot)',
      },
    );
  });
});

describe('parseLiquipediaMatch', () => {
  it('extracts the match header, teams, form, score, and tournament', () => {
    const html = `
      <div class="match-bm">
        <div class="match-bm-match-header">
          <div class="match-bm-match-header-date">
            <span>June 21, 2026 - 10:00 <abbr>CEST</abbr></span>
          </div>
          <div class="match-bm-match-header-overview">
            <div class="match-bm-match-header-opponent match-bm-match-header-team">
              <img alt="Team Spirit" src="/commons/spirit-light.png">
              <img alt="Team Spirit" src="/commons/spirit-darkmode.png">
              <div class="match-bm-match-header-team-long"><a>Team Spirit</a></div>
              <div class="match-bm-match-header-team-short"><a>TSpirit</a></div>
              <div class="match-bm-match-header-round-results">
                <div data-label-type="result-win"></div>
                <div data-label-type="result-win"></div>
                <div data-label-type="result-default"></div>
              </div>
            </div>
            <div class="match-bm-match-header-result">2&#160;:&#160;0
              <div class="match-bm-match-header-result-text">finished</div>
            </div>
            <div class="match-bm-match-header-opponent match-bm-match-header-team">
              <img alt="VP.Prodigy" src="/commons/vpp.png">
              <div class="match-bm-match-header-team-long"><a>VP.Prodigy</a></div>
              <div class="match-bm-match-header-team-short"><a>VP.P</a></div>
              <div class="match-bm-match-header-round-results">
                <div data-label-type="result-loss"></div>
                <div data-label-type="result-loss"></div>
                <div data-label-type="result-default"></div>
              </div>
            </div>
          </div>
          <div class="match-bm-match-header-tournament">
            <a>The International 2026: Europe Regional Qualifier</a>
          </div>
        </div>
      </div>
      <div class="toggle-area"></div>
    `;

    expect(parseLiquipediaMatch(html, new URL('https://liquipedia.net/dota2/Match:Example')))
      .toEqual({
        date: 'June 21, 2026 - 10:00 CEST',
        status: 'finished',
        score: ['2', '0'],
        teams: [
          {
            name: 'Team Spirit',
            shortName: 'TSpirit',
            logo: 'https://liquipedia.net/commons/spirit-darkmode.png',
            results: ['win', 'win', 'default'],
          },
          {
            name: 'VP.Prodigy',
            shortName: 'VP.P',
            logo: 'https://liquipedia.net/commons/vpp.png',
            results: ['loss', 'loss', 'default'],
          },
        ],
        tournament: 'The International 2026: Europe Regional Qualifier',
      });
  });
});

describe('fetchRedditPreviewImage', () => {
  it('only accepts generated Reddit preview image URLs', async () => {
    await expect(fetchRedditPreviewImage('https://example.com/preview/post/abc123'))
      .rejects.toMatchObject({ status: 400, code: 'invalid_reddit_preview' });
  });
});
