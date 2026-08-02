import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvPlayerStatsPreview,
  HltvRoundHalf,
  HltvRoundOutcome,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import {
  alignHltvRoundHistoryToScore,
  findHltvMapDisplayName,
} from './hltvHtmlParser.js';

export interface HltvScorebotSnapshot {
  currentMap: HltvCurrentMapPreview;
  playerStats: HltvMatchPlayerStatsPreview;
  teamSides: HltvMatchTeamSidesPreview;
  roundHistory: HltvRoundPreview[] | null;
}

export interface HltvScorebotTeamIds {
  firstTeamId: number;
  ctTeamId: number;
  terroristTeamId: number;
}

type HltvScoreboard = Record<string, unknown> & { mapName: string };

export function parseHltvScoreboardUpdate(
  value: unknown,
  html: string,
  team1Id: string,
): HltvCurrentMapPreview | null {
  return parseHltvScoreboardSnapshot(value, html, team1Id)?.currentMap ?? null;
}

export function parseHltvScoreboardSnapshot(
  value: unknown,
  html: string,
  team1Id: string,
): HltvScorebotSnapshot | null {
  if (!isHltvScoreboard(value)) return null;
  const mapName = value.mapName.trim();
  const teamIds = parseHltvScorebotTeamIds(value, team1Id);
  const ctScore = parseFiniteNumber(value.ctTeamScore ?? value.counterTerroristScore);
  const terroristScore = parseFiniteNumber(value.tTeamScore ?? value.terroristScore);
  if (
    !mapName
    || !teamIds
    || ctScore === null
    || terroristScore === null
  ) return null;

  const score: [string, string] = teamIds.firstTeamId === teamIds.ctTeamId
    ? [String(ctScore), String(terroristScore)]
    : [String(terroristScore), String(ctScore)];

  const ctPlayers = parseHltvScoreboardPlayers(value.CT);
  const terroristPlayers = parseHltvScoreboardPlayers(value.TERRORIST);
  const playerStats: HltvMatchPlayerStatsPreview = teamIds.firstTeamId === teamIds.ctTeamId
    ? [ctPlayers, terroristPlayers]
    : [terroristPlayers, ctPlayers];

  const roundHistory = parseHltvRoundHistory(
    value,
    teamIds.firstTeamId,
    teamIds.ctTeamId,
    teamIds.terroristTeamId,
  );

  return {
    currentMap: { name: findHltvMapDisplayName(html, mapName), score },
    playerStats,
    teamSides: teamIds.firstTeamId === teamIds.ctTeamId ? ['ct', 't'] : ['t', 'ct'],
    roundHistory: alignHltvRoundHistoryToScore(roundHistory, score),
  };
}

export function parseHltvScorebotTeamIds(
  value: unknown,
  team1Id: string,
): HltvScorebotTeamIds | null {
  if (!isRecord(value)) return null;
  const firstTeamId = parseFiniteNumber(team1Id);
  const ctTeamId = parseFiniteNumber(value.ctTeamId);
  const terroristTeamId = parseFiniteNumber(value.tTeamId);
  if (
    firstTeamId === null
    || ctTeamId === null
    || terroristTeamId === null
    || ![ctTeamId, terroristTeamId].includes(firstTeamId)
  ) return null;
  return { firstTeamId, ctTeamId, terroristTeamId };
}

export function parseHltvRoundHistory(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): HltvRoundPreview[] | null {
  if (!isRecord(value)) return null;

  const rawHistory = [
    value.roundHistory,
    value.rounds,
    value.history,
  ].find(Array.isArray);
  if (!Array.isArray(rawHistory)) return parseTeamRoundHistories(
    value,
    firstTeamId,
    ctTeamId,
    terroristTeamId,
  );

  const rounds = rawHistory.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const round = parseFiniteNumber(entry.round ?? entry.roundNumber ?? index + 1);
    const team = parseRoundTeam(
      entry.winner ?? entry.winnerTeam ?? entry.team ?? entry.winningTeam ?? entry.winnerSide,
      firstTeamId,
      ctTeamId,
      terroristTeamId,
    );
    if (round === null || !Number.isInteger(round) || round < 1 || team === null) return [];
    const half = parseRoundHalf(entry.half);
    return [{
      round,
      teamIndex: team,
      outcome: parseRoundOutcome(entry.outcome ?? entry.winType ?? entry.type ?? entry.reason),
      ...(half ? { half } : {}),
    }];
  });
  return rounds.length > 0 ? rounds : null;
}

/** Parses RoundEnd events sent by the live HLTV Scorebot. */
export function parseHltvScorebotLog(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
  previousHistory: HltvRoundPreview[] = [],
): HltvRoundPreview[] {
  const entries = getScorebotLogEntries(value);
  if (entries.length === 0) return previousHistory;

  const rounds = new Map(previousHistory.map((round) => [round.round, round]));
  let nextRound = Math.max(0, ...rounds.keys());
  entries.forEach((entry) => {
    const event = getRoundEndEvent(entry);
    if (!event) return;

    const winner = firstDefined(
      event.winnerSide,
      event.winnerTeam,
      event.winningTeam,
      event.winner,
      event.team,
      event.side,
    );
    const teamIndex = parseRoundTeam(winner, firstTeamId, ctTeamId, terroristTeamId);
    if (teamIndex === null) return;

    const explicitRound = parseFiniteNumber(
      firstDefined(event.round, event.roundNumber, event.roundOrdinal, event.roundId, event.currentRound),
    );
    const scoreRound = getScorebotRoundNumber(event);
    const round = [explicitRound, scoreRound].find((candidate) => (
      candidate !== null && Number.isInteger(candidate) && candidate > 0
    )) ?? nextRound + 1;
    nextRound = Math.max(nextRound, round);
    const outcomeValue = firstDefined(
      event.outcome,
      event.winType,
      event.reason,
      event.type,
      event.winnerType,
    );
    const parsedRound: HltvRoundPreview = {
      round,
      teamIndex,
      outcome: parseRoundOutcome(outcomeValue, winner, ctTeamId, terroristTeamId),
    };
    const half = parseRoundHalf(event.half);
    if (half) parsedRound.half = half;
    rounds.set(round, parsedRound);
  });

  return [...rounds.values()].sort((first, second) => first.round - second.round);
}

function getScorebotRoundNumber(event: Record<string, unknown>): number | null {
  const ctScore = parseFiniteNumber(
    firstDefined(event.counterTerroristScore, event.ctScore, event.ctTeamScore),
  );
  const terroristScore = parseFiniteNumber(
    firstDefined(event.terroristScore, event.tScore, event.tTeamScore),
  );
  if (ctScore === null || terroristScore === null) return null;
  const round = ctScore + terroristScore;
  return Number.isInteger(round) && round > 0 ? round : null;
}

function getScorebotLogEntries(value: unknown): unknown[] {
  if (typeof value === 'string') {
    try {
      return getScorebotLogEntries(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ['log', 'fullLog', 'events']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return getRoundEndEvent(value) ? [value] : [];
}

function getRoundEndEvent(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  for (const [key, payload] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
    if (normalizedKey === 'roundend' || normalizedKey === 'roundendofficial') {
      return isRecord(payload) ? payload : value;
    }
  }

  const eventName = firstDefined(value.event, value.eventName, value.name, value.kind);
  if (typeof eventName === 'string' && eventName.toLowerCase().replace(/[^a-z]/g, '').startsWith('roundend')) {
    return isRecord(value.data) ? value.data : value;
  }
  return null;
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function parseTeamRoundHistories(
  value: Record<string, unknown>,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): HltvRoundPreview[] | null {
  const startingCtTeamId = parseScorebotTeamReference(
    value.startingCt,
    firstTeamId,
    ctTeamId,
    terroristTeamId,
  ) ?? ctTeamId;
  const startingTerroristTeamId = parseScorebotTeamReference(
    value.startingT,
    firstTeamId,
    ctTeamId,
    terroristTeamId,
  ) ?? terroristTeamId;
  const candidates = [
    ...getHalfHistoryCandidates(
      value.ctMatchHistory ?? value.ctHistory ?? value.counterTerroristHistory,
      teamIndexForSide(startingCtTeamId, firstTeamId, ctTeamId, terroristTeamId),
      teamIndexForSide(startingTerroristTeamId, firstTeamId, ctTeamId, terroristTeamId),
      'ct',
    ),
    ...getHalfHistoryCandidates(
      value.terroristMatchHistory ?? value.tHistory ?? value.terroristHistory,
      teamIndexForSide(startingTerroristTeamId, firstTeamId, ctTeamId, terroristTeamId),
      teamIndexForSide(startingCtTeamId, firstTeamId, ctTeamId, terroristTeamId),
      't',
    ),
  ];
  const rounds = candidates.flatMap(({ value: history, team, side, half }) => {
    return getHistoryEntries(history).flatMap((entry, index) => {
      if (!isRecord(entry)) return [];
      const outcomeValue = firstDefined(entry.outcome, entry.winType, entry.type, entry.reason);
      if (isLostRound(outcomeValue)) return [];
      const round = parseFiniteNumber(
        entry.round ?? entry.roundNumber ?? entry.roundOrdinal ?? index + 1,
      );
      if (round === null || !Number.isInteger(round) || round < 1) return [];
      const parsedRound: HltvRoundPreview = {
        round,
        teamIndex: team,
        outcome: parseRoundOutcome(
          outcomeValue,
          side === 'ct' ? 'CT' : 'T',
          ctTeamId,
          terroristTeamId,
        ),
      };
      if (half) parsedRound.half = half;
      return [parsedRound];
    });
  });
  return rounds.length > 0 ? rounds.sort((first, second) => first.round - second.round) : null;
}

function getHalfHistoryCandidates(
  history: unknown,
  firstHalfTeam: 0 | 1,
  secondHalfTeam: 0 | 1,
  side: 'ct' | 't',
): Array<{ value: unknown; team: 0 | 1; side: 'ct' | 't'; half?: HltvRoundHalf }> {
  if (!isRecord(history) || (!('firstHalf' in history) && !('secondHalf' in history))) {
    return [{ value: history, team: firstHalfTeam, side }];
  }
  return [
    { value: history.firstHalf, team: firstHalfTeam, side, half: 1 },
    { value: history.secondHalf, team: secondHalfTeam, side, half: 2 },
  ];
}

function parseScorebotTeamReference(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): number | null {
  const numeric = parseFiniteNumber(value);
  if (numeric === null) return null;
  if (numeric === firstTeamId || numeric === ctTeamId || numeric === terroristTeamId) return numeric;
  // Some older payloads use the HLTV team order instead of database IDs.
  if (numeric === 0) return firstTeamId;
  if (numeric === 1) return firstTeamId === ctTeamId ? terroristTeamId : ctTeamId;
  return null;
}

function getHistoryEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(getHistoryEntries);
  if (!isRecord(value)) return [];
  const halves = [value.firstHalf, value.secondHalf].filter((half) => half !== undefined);
  return halves.length > 0 ? halves.flatMap(getHistoryEntries) : [value];
}

function isLostRound(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'lost';
}

function parseRoundHalf(value: unknown): HltvRoundHalf | null {
  const half = parseFiniteNumber(value);
  return half === 1 || half === 2 ? half : null;
}

function teamIndexForSide(
  sideTeamId: number,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): 0 | 1 {
  if (sideTeamId === firstTeamId) return 0;
  if (sideTeamId === ctTeamId || sideTeamId === terroristTeamId) return 1;
  return sideTeamId === ctTeamId ? 0 : 1;
}

function parseRoundTeam(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): 0 | 1 | null {
  if (typeof value === 'number') {
    if (value === firstTeamId) return 0;
    if (value === ctTeamId || value === terroristTeamId) {
      return value === firstTeamId ? 0 : 1;
    }
    // The legacy Scorebot enum uses 0 for T and 1 for CT.
    if (value === 0 || value === 1) {
      const sideTeamId = value === 0 ? terroristTeamId : ctTeamId;
      return sideTeamId === firstTeamId ? 0 : 1;
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[ -]/g, '_');
  if (normalized === 'ct' || normalized === 'counter_terrorist' || normalized === 'counter_terrorists') {
    return ctTeamId === firstTeamId ? 0 : 1;
  }
  if (normalized === 't' || normalized === 'terrorist' || normalized === 'terrorists') {
    return terroristTeamId === firstTeamId ? 0 : 1;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric)
    ? parseRoundTeam(numeric, firstTeamId, ctTeamId, terroristTeamId)
    : null;
}

function parseRoundOutcome(
  value: unknown,
  winner: unknown = undefined,
  ctTeamId: number | undefined = undefined,
  terroristTeamId: number | undefined = undefined,
): HltvRoundOutcome {
  if (typeof value === 'number') return 'unknown';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/[ -]/g, '_');
    if (normalized.includes('defus')) return 'bomb_defused';
    if (
      normalized.includes('explod')
      || normalized.includes('detonat')
      || normalized.includes('target_bombed')
    ) return 'bomb_exploded';
    if (
      normalized.includes('stopwatch')
      || normalized.includes('time')
      || normalized.includes('target_saved')
    ) return 'stopwatch';
    if (normalized.includes('ct') || normalized.includes('counter')) return 'ct_win';
    if (normalized === 't' || normalized === 't_win' || normalized.includes('terror')) return 't_win';
  }

  if (typeof winner === 'string') {
    const normalizedWinner = winner.trim().toLowerCase().replace(/[ -]/g, '_');
    if (normalizedWinner === 'ct' || normalizedWinner.includes('counter')) return 'ct_win';
    if (normalizedWinner === 't' || normalizedWinner.includes('terror')) return 't_win';
  }
  if (typeof winner === 'number' && ctTeamId !== undefined && terroristTeamId !== undefined) {
    if (winner === ctTeamId || winner === 1) return 'ct_win';
    if (winner === terroristTeamId || winner === 0) return 't_win';
  }
  return 'unknown';
}

function parseHltvScoreboardPlayers(value: unknown): HltvPlayerStatsPreview[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const nickname = typeof entry.nick === 'string' && entry.nick.trim()
      ? entry.nick.trim()
      : typeof entry.name === 'string' ? entry.name.trim() : '';
    const kills = parseFiniteNumber(entry.score);
    const deaths = parseFiniteNumber(entry.deaths);
    const assists = parseFiniteNumber(entry.assists);
    const adr = parseFiniteNumber(entry.damagePrRound);
    if (!nickname || kills === null || deaths === null || assists === null || adr === null) return [];
    return [{ nickname, kills, deaths, assists, adr: Math.round(adr * 10) / 10 }];
  });
}

function isHltvScoreboard(value: unknown): value is HltvScoreboard {
  return isRecord(value) && typeof value.mapName === 'string';
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
