import type { OpenGraphPreview } from './previewContracts.js';

const OPEN_GRAPH_MATCH_STATUSES = new Set([
  'scheduled',
  'live',
  'over',
  'postponed',
  'deleted',
]);

export function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  if (!isRecord(value)) return false;
  const object = value;

  const matchStatus = object.matchStatus;
  const matchScore = object.matchScore;
  const matchCurrentMap = object.matchCurrentMap;
  const matchCompletedMaps = object.matchCompletedMaps;
  const matchPlayerStats = object.matchPlayerStats;
  const matchTeamSides = object.matchTeamSides;
  const matchTeams = object.matchTeams;

  return typeof object.url === 'string'
    && [object.title, object.description, object.image, object.video, object.siteName, object.type]
      .every(isNullableString)
    && (object.matchStartsAt === undefined || isNullableString(object.matchStartsAt))
    && (
      matchStatus === undefined
      || matchStatus === null
      || isMatchStatus(matchStatus)
    )
    && (matchScore === undefined || matchScore === null || isStringPair(matchScore))
    && (matchCurrentMap === undefined || matchCurrentMap === null || isHltvCurrentMap(matchCurrentMap))
    && (
      matchCompletedMaps === undefined
      || matchCompletedMaps === null
      || (Array.isArray(matchCompletedMaps) && matchCompletedMaps.every(isHltvCurrentMap))
    )
    && (
      matchPlayerStats === undefined
      || matchPlayerStats === null
      || (
        Array.isArray(matchPlayerStats)
        && matchPlayerStats.length === 2
        && matchPlayerStats.every(
          (team) => Array.isArray(team) && team.every(isHltvPlayerStats),
        )
      )
    )
    && (
      matchTeamSides === undefined
      || matchTeamSides === null
      || (
        isStringPair(matchTeamSides)
        && (
          (matchTeamSides[0] === 'ct' && matchTeamSides[1] === 't')
          || (matchTeamSides[0] === 't' && matchTeamSides[1] === 'ct')
        )
      )
    )
    && (
      matchTeams === undefined
      || matchTeams === null
      || (
        Array.isArray(matchTeams)
        && matchTeams.length === 2
        && matchTeams.every(isHltvMatchTeam)
      )
    );
}

function isMatchStatus(value: unknown): boolean {
  return typeof value === 'string' && OPEN_GRAPH_MATCH_STATUSES.has(value);
}

function isHltvPlayerStats(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const object = value;
  return typeof object.nickname === 'string'
    && [object.kills, object.deaths, object.assists, object.adr]
      .every((number) => typeof number === 'number' && Number.isFinite(number));
}

function isHltvCurrentMap(value: unknown): boolean {
  return isRecord(value)
    && typeof value.name === 'string'
    && isStringPair(value.score);
}

function isHltvMatchTeam(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && isNullableString(value.logo);
}

function isStringPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getStringProperty(value: unknown, property: string): string | null {
  if (!isRecord(value)) return null;
  const propertyValue = value[property];
  return typeof propertyValue === 'string' ? propertyValue : null;
}
