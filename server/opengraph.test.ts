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
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
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
      matchTeams: null,
      matchStatus: null,
      matchScore: null,
      matchCurrentMap: null,
      matchPlayerStats: null,
    });
  });

  it('extracts the scheduled start from an HLTV match page', () => {
    const html = `
      <meta property="og:title" content="Liquid vs Spirit">
      <div class="timeAndEvent">
        <div class="time" data-time-format="HH:mm" data-unix="1784829900000">20:05</div>
        <div class="date" data-unix="1784829900000">23rd of July 2026</div>
      </div>
      <div class="team1-gradient">
        <img alt="Liquid" src="/teamlogo/liquid.png" class="logo">
        <div class="teamName">Liquid</div>
      </div>
      <div class="team2-gradient">
        <img alt="Spirit" src="https://cdn.example/spirit.png" class="logo day-only">
        <img alt="Spirit" src="https://cdn.example/spirit-dark.png" class="logo night-only">
        <div class="teamName">Spirit</div>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://www.hltv.org/matches/2396006/liquid-vs-spirit'),
    )).toMatchObject({
      matchStartsAt: '2026-07-23T18:05:00.000Z',
      matchTeams: [
        { name: 'Liquid', logo: 'https://www.hltv.org/teamlogo/liquid.png' },
        { name: 'Spirit', logo: 'https://cdn.example/spirit.png' },
      ],
    });
  });

  it('extracts and updates the series score only while an HLTV match is live', () => {
    const html = `
      <div class="timeAndEvent">
        <div class="countdown" data-time-countdown="LIVE">LIVE</div>
      </div>
      <div class="mapholder">
        <div class="results played">
          <div class="results-left won pick"><div class="results-team-score">13</div></div>
          <div class="results-center"><a class="results-stats" href="/stats/matches/mapstatsid/1">STATS</a></div>
          <span class="results-right lost"><div class="results-team-score">10</div></span>
        </div>
      </div>
      <div class="mapholder">
        <div class="results played">
          <div class="map-name-holder"><div class="mapname">Anubis</div></div>
          <div class="results-left won"><div class="results-team-score">12</div></div>
          <span class="results-right lost pick"><div class="results-team-score">10</div></span>
        </div>
      </div>
      <div class="mapholder">
        <div class="results optional">
          <div class="results-left tie"><div class="results-team-score">-</div></div>
          <span class="results-right tie"><div class="results-team-score">-</div></span>
        </div>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://www.hltv.org/matches/2396277/ww-vs-tdk-event'),
    )).toMatchObject({
      matchStatus: 'live',
      matchScore: ['1', '0'],
      matchCurrentMap: {
        name: 'Anubis',
        score: ['12', '10'],
      },
    });

    expect(parseOpenGraph(
      html.replace('LIVE</div>', 'Match over</div>'),
      new URL('https://www.hltv.org/matches/2396277/ww-vs-tdk-event'),
    )).toMatchObject({
      matchStatus: 'over',
      matchScore: ['1', '0'],
      matchCurrentMap: null,
    });
  });

  it('maps a Scorebot update back to the HLTV team order and map name', () => {
    const html = `
      <div class="mapholder">
        <div class="map-name-holder"><div class="mapname">Dust2</div></div>
      </div>
    `;

    expect(parseHltvScoreboardUpdate({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 2,
      tTeamScore: 3,
    }, html, '5973')).toEqual({
      name: 'Dust2',
      score: ['2', '3'],
    });

    expect(parseHltvScoreboardUpdate({
      mapName: 'de_dust2',
      ctTeamId: 7020,
      tTeamId: 5973,
      ctTeamScore: 5,
      tTeamScore: 7,
    }, html, '5973')).toEqual({
      name: 'Dust2',
      score: ['7', '5'],
    });
  });

  it('extracts live player statistics from a Scorebot update', () => {
    const html = '<div class="mapholder"><div class="mapname">Dust2</div></div>';
    const player = {
      nick: 'NAF',
      score: 7,
      deaths: 3,
      assists: 2,
      damagePrRound: 91.26,
    };

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 4,
      tTeamScore: 2,
      CT: [player],
      TERRORIST: [{
        nick: 'donk',
        score: 5,
        deaths: 4,
        assists: 1,
        damagePrRound: 84,
      }],
    }, html, '5973')).toMatchObject({
      playerStats: [
        [{
          nickname: 'NAF',
          kills: 7,
          deaths: 3,
          assists: 2,
          adr: 91.3,
        }],
        [{
          nickname: 'donk',
          kills: 5,
          deaths: 4,
          assists: 1,
          adr: 84,
        }],
      ],
    });
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

  it('upgrades VK image CDN URLs to HTTPS', () => {
    const html = `
      <meta property="og:image"
        content="http://sun9-67.vkuserphoto.ru/impg/photo.jpg?size=1170x1560">
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://vk.ru/wall-118222154_8712'),
    ).image).toBe(
      'https://sun9-67.vkuserphoto.ru/impg/photo.jpg?size=1170x1560',
    );
  });

  it('extracts a VK video embed and thumbnail from structured data', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "SocialMediaPosting",
          "video": [{
            "@type": "VideoObject",
            "thumbnailUrl": "https://iv.okcdn.ru/getVideoPreview?id=123",
            "embedUrl": "https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret"
          }]
        }
      </script>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://vk.ru/wall-28905875_36129480'),
    )).toMatchObject({
      image: 'https://iv.okcdn.ru/getVideoPreview?id=123',
      video: 'https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret',
    });
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

  it('prefers the original Rezka cover over its small social preview', () => {
    const html = `
      <meta property="og:image" content="/covers/social.jpg">
      <div class="b-sidecover">
        <a data-imagelightbox="cover" href="/covers/original.jpg">
          <img src="/covers/thumbnail.jpg" alt="Story">
        </a>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://rezka.ag/films/drama/123-story.html'),
    ).image).toBe('https://rezka.ag/covers/original.jpg');
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
