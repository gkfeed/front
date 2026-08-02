import { describe, expect, it } from 'vitest';

import {
  parseHltvScorebotLog,
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

  it('extracts the native Scorebot match-history rows', () => {
    const html = '<div class="mapholder"><div class="mapname">Dust2</div></div>';

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 2,
      tTeamScore: 1,
      ctMatchHistory: {
        firstHalf: [
          { type: 'Lost', roundOrdinal: 1 },
          { type: 'Bomb_Defused', roundOrdinal: 2 },
        ],
        secondHalf: [],
      },
      terroristMatchHistory: {
        firstHalf: [
          { type: 'Target_Bombed', roundOrdinal: 1 },
          { type: 'Lost', roundOrdinal: 2 },
        ],
        secondHalf: [],
      },
      CT: [],
      TERRORIST: [],
    }, html, '5973')?.roundHistory).toEqual([
      { round: 1, teamIndex: 1, outcome: 'bomb_exploded', half: 1 },
      { round: 2, teamIndex: 0, outcome: 'bomb_defused', half: 1 },
    ]);
  });

  it('keeps round winners with their team after the half-side swap', () => {
    const html = '<div class="mapholder"><div class="mapname">Ancient</div></div>';

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_ancient',
      // Team 7020 is CT now, but team 5973 started the map on CT.
      ctTeamId: 7020,
      tTeamId: 5973,
      startingCt: 5973,
      startingT: 7020,
      ctTeamScore: 2,
      tTeamScore: 2,
      ctMatchHistory: {
        firstHalf: [{ type: 'CTs_Win', roundOrdinal: 1 }],
        secondHalf: [{ type: 'CTs_Win', roundOrdinal: 3 }],
      },
      terroristMatchHistory: {
        firstHalf: [{ type: 'Target_Bombed', roundOrdinal: 2 }],
        secondHalf: [{ type: 'Target_Bombed', roundOrdinal: 4 }],
      },
      CT: [],
      TERRORIST: [],
    }, html, '5973')?.roundHistory).toEqual([
      { round: 1, teamIndex: 0, outcome: 'ct_win', half: 1 },
      { round: 2, teamIndex: 1, outcome: 'bomb_exploded', half: 1 },
      { round: 3, teamIndex: 1, outcome: 'ct_win', half: 2 },
      { round: 4, teamIndex: 0, outcome: 'bomb_exploded', half: 2 },
    ]);
  });

  it('maps Scorebot round history to the HLTV team order', () => {
    const html = '<div class="mapholder"><div class="mapname">Dust2</div></div>';

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_dust2',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 2,
      tTeamScore: 1,
      roundHistory: [
        { round: 1, winner: 'T', winType: 'bomb_exploded' },
        { round: 2, winner: 'CT', winType: 'ct_win' },
      ],
      CT: [],
      TERRORIST: [],
    }, html, '5973')?.roundHistory).toEqual([
      { round: 1, teamIndex: 1, outcome: 'bomb_exploded' },
      { round: 2, teamIndex: 0, outcome: 'ct_win' },
    ]);
  });

  it('aligns a reversed one-round history with the live map score', () => {
    const html = '<div class="mapholder"><div class="mapname">Nuke</div></div>';

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_nuke',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 0,
      tTeamScore: 1,
      roundHistory: [
        { round: 1, winner: 'CT', winType: 'ct_win' },
      ],
      CT: [],
      TERRORIST: [],
    }, html, '5973')?.roundHistory).toEqual([
      { round: 1, teamIndex: 1, outcome: 'ct_win' },
    ]);
  });

  it('normalizes a mismatched winner distribution to the live map score', () => {
    const html = '<div class="mapholder"><div class="mapname">Nuke</div></div>';

    expect(parseHltvScoreboardSnapshot({
      mapName: 'de_nuke',
      ctTeamId: 5973,
      tTeamId: 7020,
      ctTeamScore: 1,
      tTeamScore: 2,
      roundHistory: [
        { round: 1, winner: 'CT', winType: 'ct_win' },
        { round: 2, winner: 'CT', winType: 'ct_win' },
        { round: 3, winner: 'CT', winType: 'ct_win' },
      ],
      CT: [],
      TERRORIST: [],
    }, html, '5973')?.roundHistory).toEqual([
      { round: 1, teamIndex: 0, outcome: 'ct_win' },
      { round: 2, teamIndex: 1, outcome: 'ct_win' },
      { round: 3, teamIndex: 1, outcome: 'ct_win' },
    ]);
  });

  it('extracts round results from Scorebot log events', () => {
    expect(parseHltvScorebotLog({
      log: [
        {
          RoundEnd: {
            counterTerroristScore: 0,
            terroristScore: 1,
            winner: 'TERRORIST',
            winType: 'Target_Bombed',
          },
        },
        {
          RoundEnd: {
            counterTerroristScore: 1,
            terroristScore: 1,
            winner: 'CT',
            winType: 'Target_Saved',
          },
        },
        {
          RoundEnd: {
            counterTerroristScore: 1,
            terroristScore: 2,
            winner: 7020,
            winType: 'Target_Defused',
          },
        },
      ],
    }, 5973, 5973, 7020)).toEqual([
      { round: 1, teamIndex: 1, outcome: 'bomb_exploded' },
      { round: 2, teamIndex: 0, outcome: 'stopwatch' },
      { round: 3, teamIndex: 1, outcome: 'bomb_defused' },
    ]);
  });

  it('parses HLTV round-history scoreboard icons from a map overview', () => {
    const html = `
      <div class="round-history">
        <img src="/img/static/scoreboard/bomb_exploded.svg" alt="1-0">
        <img src="/img/static/scoreboard/emptyHistory.svg" alt="">
        <img src="/img/static/scoreboard/emptyHistory.svg" alt="">
        <img src="/img/static/scoreboard/ct_win.svg" alt="1-1">
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://www.hltv.org/matches/2396277/ww-vs-tdk-event'),
    ).providerData).toMatchObject({
      provider: 'hltv',
      snapshot: {
        roundHistory: [
          { round: 1, teamIndex: 0, outcome: 'bomb_exploded' },
          { round: 2, teamIndex: 1, outcome: 'ct_win' },
        ],
      },
    });
  });

  it('does not carry completed-map round icons into a new 0:0 map', () => {
    const html = `
      <div class="timeAndEvent"><div class="countdown">LIVE</div></div>
      <div class="mapholder">
        <div class="mapname">Ancient</div>
        <a class="results-stats" href="/stats/matches/mapstatsid/1">STATS</a>
        <div class="round-history">
          <img src="/img/static/scoreboard/ct_win.svg" alt="1-0">
          <img src="/img/static/scoreboard/emptyHistory.svg" alt="">
          <img src="/img/static/scoreboard/emptyHistory.svg" alt="">
          <img src="/img/static/scoreboard/t_win.svg" alt="0-1">
        </div>
      </div>
      <div class="mapholder">
        <div class="mapname">Nuke</div>
        <div class="results-team-score">0</div>
        <div class="results-team-score">0</div>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://www.hltv.org/matches/2396277/ww-vs-tdk-event'),
    ).providerData).toMatchObject({
      provider: 'hltv',
      snapshot: {
        currentMap: { name: 'Nuke', score: ['0', '0'] },
        roundHistory: null,
      },
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
