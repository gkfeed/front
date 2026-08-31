import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvPlayerStatsPreview,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import {
  alignHltvRoundHistoryToScore,
  findHltvMapDisplayName,
} from './hltvHtmlParser.js';
import { parseHltvRoundHistory } from './hltvScorebotRounds.js';
import { parseFiniteNumber } from './hltvScorebotValues.js';

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
  if (!mapName || !teamIds || ctScore === null || terroristScore === null) return null;

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
