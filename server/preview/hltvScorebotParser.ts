import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvPlayerStatsPreview,
} from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
import { findHltvMapDisplayName } from './hltvHtmlParser.js';

export interface HltvScorebotSnapshot {
  currentMap: HltvCurrentMapPreview;
  playerStats: HltvMatchPlayerStatsPreview;
  teamSides: HltvMatchTeamSidesPreview;
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
  const ctTeamId = parseFiniteNumber(value.ctTeamId);
  const terroristTeamId = parseFiniteNumber(value.tTeamId);
  const ctScore = parseFiniteNumber(value.ctTeamScore ?? value.counterTerroristScore);
  const terroristScore = parseFiniteNumber(value.tTeamScore ?? value.terroristScore);
  const firstTeamId = parseFiniteNumber(team1Id);
  if (
    !mapName
    || ctTeamId === null
    || terroristTeamId === null
    || ctScore === null
    || terroristScore === null
    || firstTeamId === null
    || ![ctTeamId, terroristTeamId].includes(firstTeamId)
  ) return null;

  const score: [string, string] = firstTeamId === ctTeamId
    ? [String(ctScore), String(terroristScore)]
    : [String(terroristScore), String(ctScore)];

  const ctPlayers = parseHltvScoreboardPlayers(value.CT);
  const terroristPlayers = parseHltvScoreboardPlayers(value.TERRORIST);
  const playerStats: HltvMatchPlayerStatsPreview = firstTeamId === ctTeamId
    ? [ctPlayers, terroristPlayers]
    : [terroristPlayers, ctPlayers];

  return {
    currentMap: { name: findHltvMapDisplayName(html, mapName), score },
    playerStats,
    teamSides: firstTeamId === ctTeamId ? ['ct', 't'] : ['t', 'ct'],
  };
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
