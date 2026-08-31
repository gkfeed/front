import type {
  HltvRoundHalf,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import {
  parseScorebotRoundHalf,
  parseScorebotRoundOutcome,
  parseScorebotRoundTeam,
} from './hltvScorebotRoundValues.js';
import { firstDefined, parseFiniteNumber } from './hltvScorebotValues.js';

export function parseHltvRoundHistory(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): HltvRoundPreview[] | null {
  if (!isRecord(value)) return null;
  const rawHistory = [value.roundHistory, value.rounds, value.history].find(Array.isArray);
  if (!Array.isArray(rawHistory)) return parseTeamRoundHistories(
    value,
    firstTeamId,
    ctTeamId,
    terroristTeamId,
  );

  const rounds = rawHistory.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const round = parseFiniteNumber(entry.round ?? entry.roundNumber ?? index + 1);
    const team = parseScorebotRoundTeam(
      entry.winner ?? entry.winnerTeam ?? entry.team ?? entry.winningTeam ?? entry.winnerSide,
      firstTeamId,
      ctTeamId,
      terroristTeamId,
    );
    if (round === null || !Number.isInteger(round) || round < 1 || team === null) return [];
    const half = parseScorebotRoundHalf(entry.half);
    return [{
      round,
      teamIndex: team,
      outcome: parseScorebotRoundOutcome(entry.outcome ?? entry.winType ?? entry.type ?? entry.reason),
      ...(half ? { half } : {}),
    }];
  });
  return rounds.length > 0 ? rounds : null;
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
        outcome: parseScorebotRoundOutcome(
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
