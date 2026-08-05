import { getObjectProperty } from '../unknownObject';
import type {
  LiquipediaMatchPreview,
  LiquipediaMatchTeam,
} from '../../../shared/previewContracts';
import { requestBffJson } from './bffClient';

export type {
  LiquipediaMatchPreview,
  LiquipediaMatchResult,
  LiquipediaMatchTeam,
} from '../../../shared/previewContracts';

export async function getLiquipediaMatchPreview(
  url: string,
  signal?: AbortSignal,
): Promise<LiquipediaMatchPreview> {
  return requestBffJson({
    endpoint: '/bff/liquipedia-match',
    input: url,
    resourceName: 'Liquipedia preview',
    validate: isLiquipediaMatchPreview,
    signal,
  });
}

function isLiquipediaMatchPreview(value: unknown): value is LiquipediaMatchPreview {
  const date = getObjectProperty(value, 'date');
  const status = getObjectProperty(value, 'status');
  const score = getObjectProperty(value, 'score');
  const teams = getObjectProperty(value, 'teams');
  const tournament = getObjectProperty(value, 'tournament');

  return typeof date === 'string'
    && typeof status === 'string'
    && Array.isArray(score)
    && score.length === 2
    && score.every((part) => typeof part === 'string')
    && Array.isArray(teams)
    && teams.length === 2
    && teams.every(isLiquipediaMatchTeam)
    && typeof tournament === 'string';
}

function isLiquipediaMatchTeam(value: unknown): value is LiquipediaMatchTeam {
  const name = getObjectProperty(value, 'name');
  const shortName = getObjectProperty(value, 'shortName');
  const logo = getObjectProperty(value, 'logo');
  const results = getObjectProperty(value, 'results');

  return typeof name === 'string'
    && typeof shortName === 'string'
    && (logo === null || typeof logo === 'string')
    && Array.isArray(results)
    && results.every((result) => result === 'win' || result === 'loss' || result === 'default');
}
