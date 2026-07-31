import type {
  HltvMatchSnapshot,
  HltvProviderData,
  OpenGraphPreview,
} from './previewContracts.js';
import { isRecord } from './valueGuards.js';

const HLTV_MATCH_STATUSES = new Set([
  'scheduled',
  'live',
  'over',
  'postponed',
  'deleted',
]);

export function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  if (!isRecord(value)) return false;
  const object = value;

  return typeof object.url === 'string'
    && [object.title, object.description, object.image, object.video, object.siteName, object.type]
      .every(isNullableString)
    && isNullable(object.providerData, isHltvProviderData);
}

export function isHltvProviderData(value: unknown): value is HltvProviderData {
  return isRecord(value)
    && value.provider === 'hltv'
    && isHltvMatchSnapshot(value.snapshot);
}

function isHltvMatchSnapshot(value: unknown): value is HltvMatchSnapshot {
  if (!isRecord(value)) return false;

  return isNullableString(value.startsAt)
    && isNullable(value.teams, isHltvMatchTeams)
    && isNullable(value.status, isHltvMatchStatus)
    && isNullable(value.score, isStringPair)
    && isNullable(value.currentMap, isHltvMap)
    && isNullable(
      value.completedMaps,
      (maps) => Array.isArray(maps) && maps.every(isHltvMap),
    )
    && isNullable(
      value.playerStats,
      (stats) => Array.isArray(stats)
        && stats.length === 2
        && stats.every((team) => Array.isArray(team) && team.every(isHltvPlayerStats)),
    )
    && isNullable(value.teamSides, isHltvMatchTeamSides);
}

function isHltvMatchStatus(value: unknown): boolean {
  return typeof value === 'string' && HLTV_MATCH_STATUSES.has(value);
}

function isHltvPlayerStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const object = value;
  return typeof object.nickname === 'string'
    && [object.kills, object.deaths, object.assists, object.adr]
      .every((number) => typeof number === 'number' && Number.isFinite(number));
}

function isHltvMap(value: unknown): boolean {
  return isRecord(value)
    && typeof value.name === 'string'
    && isStringPair(value.score);
}

function isHltvMatchTeam(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && isNullableString(value.logo);
}

function isHltvMatchTeams(value: unknown): value is NonNullable<HltvMatchSnapshot['teams']> {
  return Array.isArray(value)
    && value.length === 2
    && value.every(isHltvMatchTeam);
}

function isHltvMatchTeamSides(value: unknown): boolean {
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
