import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export interface HltvMatchTeamPreview {
  name: string;
  logo: string | null;
}

export interface HltvCurrentMapPreview {
  name: string;
  score: [string, string];
}

export interface HltvMapResultPreview {
  name: string;
  score: [string, string];
}

export interface HltvPlayerStatsPreview {
  nickname: string;
  kills: number;
  deaths: number;
  assists?: number;
  adr: number;
  rating?: number;
}

export type HltvMatchPlayerStatsPreview = [
  HltvPlayerStatsPreview[],
  HltvPlayerStatsPreview[],
];

export type HltvMatchTeamSidesPreview = ['ct', 't'] | ['t', 'ct'];

export type HltvRoundOutcome =
  | 'ct_win'
  | 't_win'
  | 'bomb_defused'
  | 'bomb_exploded'
  | 'stopwatch'
  | 'unknown';

export type HltvRoundHalf = 1 | 2;

export interface HltvRoundPreview {
  round: number;
  teamIndex: 0 | 1;
  outcome: HltvRoundOutcome;
  half?: HltvRoundHalf;
}

export type HltvMatchStatus = 'scheduled' | 'live' | 'over' | 'postponed' | 'deleted';

export interface HltvMatchSnapshot {
  startsAt: string | null;
  tournament?: string | null;
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview] | null;
  status: HltvMatchStatus | null;
  score: [string, string] | null;
  currentMap: HltvCurrentMapPreview | null;
  completedMaps: HltvMapResultPreview[] | null;
  roundHistory?: HltvRoundPreview[] | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
}

export interface HltvProviderData {
  provider: 'hltv';
  snapshot: HltvMatchSnapshot;
}

const MATCH_STATUSES = new Set([
  'scheduled',
  'live',
  'over',
  'postponed',
  'deleted',
]);
const ROUND_OUTCOMES = new Set([
  'ct_win',
  't_win',
  'bomb_defused',
  'bomb_exploded',
  'stopwatch',
  'unknown',
]);

export const hltvProviderDataModule: ProviderDataModule<HltvProviderData> = {
  is: isHltvProviderData,
  imageUrls: ({ snapshot }) => snapshot.teams
    ?.flatMap((team) => team.logo ? [team.logo] : [])
    ?? [],
};

export function isHltvProviderData(value: unknown): value is HltvProviderData {
  return isRecord(value)
    && value.provider === 'hltv'
    && isHltvMatchSnapshot(value.snapshot);
}

export function getHltvSnapshot(value: unknown): HltvMatchSnapshot | null {
  return isHltvProviderData(value) ? value.snapshot : null;
}

function isHltvMatchSnapshot(value: unknown): value is HltvMatchSnapshot {
  if (!isRecord(value)) return false;

  return isNullableString(value.startsAt)
    && (value.tournament === undefined || isNullableString(value.tournament))
    && isNullable(value.teams, isMatchTeams)
    && isNullable(value.status, isMatchStatus)
    && isNullable(value.score, isStringPair)
    && isNullable(value.currentMap, isMap)
    && isNullable(
      value.completedMaps,
      (maps) => Array.isArray(maps) && maps.every(isMap),
    )
    && (value.roundHistory === undefined || isNullable(
      value.roundHistory,
      (rounds) => Array.isArray(rounds) && rounds.every(isRound),
    ))
    && isNullable(
      value.playerStats,
      (stats) => Array.isArray(stats)
        && stats.length === 2
        && stats.every((team) => Array.isArray(team) && team.every(isPlayerStats)),
    )
    && isNullable(value.teamSides, isMatchTeamSides);
}

function isMatchStatus(value: unknown): boolean {
  return typeof value === 'string' && MATCH_STATUSES.has(value);
}

function isPlayerStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const object = value;
  return typeof object.nickname === 'string'
    && [object.kills, object.deaths, object.adr]
      .every((number) => typeof number === 'number' && Number.isFinite(number))
    && (object.assists === undefined
      || typeof object.assists === 'number' && Number.isFinite(object.assists))
    && (object.rating === undefined
      || typeof object.rating === 'number' && Number.isFinite(object.rating));
}

function isMap(value: unknown): boolean {
  return isRecord(value)
    && typeof value.name === 'string'
    && isStringPair(value.score);
}

function isRound(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.round === 'number'
    && Number.isInteger(value.round)
    && value.round > 0
    && (value.teamIndex === 0 || value.teamIndex === 1)
    && typeof value.outcome === 'string'
    && ROUND_OUTCOMES.has(value.outcome)
    && (value.half === undefined || value.half === 1 || value.half === 2);
}

function isMatchTeam(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && isNullableString(value.logo);
}

function isMatchTeams(value: unknown): value is NonNullable<HltvMatchSnapshot['teams']> {
  return Array.isArray(value)
    && value.length === 2
    && value.every(isMatchTeam);
}

function isMatchTeamSides(value: unknown): boolean {
  return isStringPair(value)
    && (
      (value[0] === 'ct' && value[1] === 't')
      || (value[0] === 't' && value[1] === 'ct')
    );
}

function isStringPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullable(value: unknown, guard: (value: unknown) => boolean): boolean {
  return value === null || guard(value);
}
