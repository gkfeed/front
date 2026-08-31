import type { HltvRoundPreview } from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import {
  parseScorebotRoundHalf,
  parseScorebotRoundOutcome,
  parseScorebotRoundTeam,
} from './hltvScorebotRoundValues.js';
import { firstDefined, parseFiniteNumber } from './hltvScorebotValues.js';

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
    const teamIndex = parseScorebotRoundTeam(winner, firstTeamId, ctTeamId, terroristTeamId);
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
      outcome: parseScorebotRoundOutcome(outcomeValue, winner, ctTeamId, terroristTeamId),
    };
    const half = parseScorebotRoundHalf(event.half);
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
