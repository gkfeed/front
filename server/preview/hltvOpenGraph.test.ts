import { describe, expect, it } from 'vitest';

import {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvScorebotParser.js';
import { parseOpenGraph } from './openGraphParser.js';

describe('parseOpenGraph: HLTV provider', () => {
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
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2026-07-23T18:05:00.000Z',
          teams: [
            { name: 'Liquid', logo: 'https://www.hltv.org/teamlogo/liquid.png' },
            { name: 'Spirit', logo: 'https://cdn.example/spirit.png' },
          ],
        },
      },
    });
  });

  it('extracts and updates the series score only while an HLTV match is live', () => {
    const html = `
      <div class="timeAndEvent">
        <div class="countdown" data-time-countdown="LIVE">LIVE</div>
      </div>
      <div class="mapholder">
        <div class="results played">
          <div class="map-name-holder"><div class="mapname">Mirage</div></div>
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
      providerData: {
        provider: 'hltv',
        snapshot: {
          status: 'live',
          score: ['1', '0'],
          currentMap: { name: 'Anubis', score: ['12', '10'] },
          completedMaps: [{ name: 'Mirage', score: ['13', '10'] }],
        },
      },
    });

    expect(parseOpenGraph(
      html.replace('LIVE</div>', 'Match over</div>'),
      new URL('https://www.hltv.org/matches/2396277/ww-vs-tdk-event'),
    )).toMatchObject({
      providerData: {
        provider: 'hltv',
        snapshot: {
          status: 'over',
          score: ['1', '0'],
          currentMap: null,
        },
      },
    });
  });
});

describe('parseHltvScoreboard: external payloads', () => {
  it('maps a Scorebot update back to the HLTV team order and map name', () => {
    const html = '<div class="mapholder"><div class="mapname">Dust2</div></div>';

    expect(parseHltvScoreboardUpdate({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 2,
      tTeamScore: 3,
    }, html, '5973')).toEqual({ name: 'Dust2', score: ['2', '3'] });

    expect(parseHltvScoreboardUpdate({
      mapName: 'de_dust2',
      ctTeamId: 7020,
      tTeamId: 5973,
      ctTeamScore: 5,
      tTeamScore: 7,
    }, html, '5973')).toEqual({ name: 'Dust2', score: ['7', '5'] });
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
      TERRORIST: [{ nick: 'donk', score: 5, deaths: 4, assists: 1, damagePrRound: 84 }],
    }, html, '5973')).toMatchObject({
      teamSides: ['ct', 't'],
      playerStats: [
        [{ nickname: 'NAF', kills: 7, deaths: 3, assists: 2, adr: 91.3 }],
        [{ nickname: 'donk', kills: 5, deaths: 4, assists: 1, adr: 84 }],
      ],
    });
  });

  it('rejects malformed Scorebot payloads without unsafe object assumptions', () => {
    const html = '<div class="mapholder"><div class="mapname">Dust2</div></div>';
    const invalidPayloads: unknown[] = [
      null,
      [],
      { mapName: 'de_dust2', ctTeamId: {}, tTeamId: 7020, ctTeamScore: 1, tTeamScore: 2 },
      { mapName: 'de_dust2', ctTeamId: 5973, tTeamId: 7020, ctTeamScore: '', tTeamScore: 2 },
    ];

    invalidPayloads.forEach((payload) => {
      expect(parseHltvScoreboardSnapshot(payload, html, '5973')).toBeNull();
    });

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 1,
      tTeamScore: 2,
      CT: [{ score: {} }],
    }, html, '5973')?.playerStats).toEqual([[], []]);
  });
});
