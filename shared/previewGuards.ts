import type { OpenGraphPreview } from './previewContracts.js';

export function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  const object = asRecord(value);
  if (!object) return false;

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
      || ['scheduled', 'live', 'over', 'postponed', 'deleted'].includes(String(matchStatus))
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

function isHltvPlayerStats(value: unknown): boolean {
  const object = asRecord(value);
  if (!object) return false;
  return typeof object.nickname === 'string'
    && [object.kills, object.deaths, object.assists, object.adr]
      .every((number) => typeof number === 'number' && Number.isFinite(number));
}

function isHltvCurrentMap(value: unknown): boolean {
  const object = asRecord(value);
  return Boolean(object)
    && typeof object!.name === 'string'
    && isStringPair(object!.score);
}

function isHltvMatchTeam(value: unknown): boolean {
  const object = asRecord(value);
  return Boolean(object) && typeof object!.name === 'string' && isNullableString(object!.logo);
}

function isStringPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((part) => typeof part === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
