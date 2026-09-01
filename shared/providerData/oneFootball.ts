import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export interface OneFootballMatchTeamPreview {
  name: string;
  logo: string | null;
}

export interface OneFootballMatchSnapshot {
  competition: string | null;
  teams: [OneFootballMatchTeamPreview, OneFootballMatchTeamPreview];
  score: [string, string] | null;
  status: string | null;
  startsAt: string | null;
}

export interface OneFootballProviderData {
  provider: 'onefootball';
  snapshot: OneFootballMatchSnapshot;
}

export const oneFootballProviderDataModule: ProviderDataModule<OneFootballProviderData> = {
  is: isOneFootballProviderData,
  imageUrls: ({ snapshot }) => snapshot.teams
    .flatMap((team) => team.logo ? [team.logo] : []),
};

export function isOneFootballProviderData(value: unknown): value is OneFootballProviderData {
  return isRecord(value)
    && value.provider === 'onefootball'
    && isOneFootballMatchSnapshot(value.snapshot);
}

export function getOneFootballSnapshot(value: unknown): OneFootballMatchSnapshot | null {
  return isOneFootballProviderData(value) ? value.snapshot : null;
}

function isOneFootballMatchSnapshot(value: unknown): value is OneFootballMatchSnapshot {
  return isRecord(value)
    && isNullableString(value.competition)
    && isMatchTeams(value.teams)
    && isNullable(value.score, isStringPair)
    && isNullableString(value.status)
    && isNullableString(value.startsAt);
}

function isMatchTeam(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && isNullableString(value.logo);
}

function isMatchTeams(value: unknown): value is OneFootballMatchSnapshot['teams'] {
  return Array.isArray(value)
    && value.length === 2
    && value.every(isMatchTeam);
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
