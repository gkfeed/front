import type {
  HltvRoundHalf,
  HltvRoundOutcome,
} from '../../shared/previewContracts.js';
import { parseFiniteNumber } from './hltvScorebotValues.js';

export function parseScorebotRoundHalf(value: unknown): HltvRoundHalf | null {
  const half = parseFiniteNumber(value);
  return half === 1 || half === 2 ? half : null;
}

export function parseScorebotRoundTeam(
  value: unknown,
  firstTeamId: number,
  ctTeamId: number,
  terroristTeamId: number,
): 0 | 1 | null {
  if (typeof value === 'number') {
    if (value === firstTeamId) return 0;
    if (value === ctTeamId || value === terroristTeamId) return value === firstTeamId ? 0 : 1;
    if (value === 0 || value === 1) {
      const sideTeamId = value === 0 ? terroristTeamId : ctTeamId;
      return sideTeamId === firstTeamId ? 0 : 1;
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[ -]/g, '_');
  if (normalized === 'ct' || normalized === 'counter_terrorist' || normalized === 'counter_terrorists') {
    return ctTeamId === firstTeamId ? 0 : 1;
  }
  if (normalized === 't' || normalized === 'terrorist' || normalized === 'terrorists') {
    return terroristTeamId === firstTeamId ? 0 : 1;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric)
    ? parseScorebotRoundTeam(numeric, firstTeamId, ctTeamId, terroristTeamId)
    : null;
}

export function parseScorebotRoundOutcome(
  value: unknown,
  winner: unknown = undefined,
  ctTeamId: number | undefined = undefined,
  terroristTeamId: number | undefined = undefined,
): HltvRoundOutcome {
  if (typeof value === 'number') return 'unknown';
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/[ -]/g, '_');
    if (normalized.includes('defus')) return 'bomb_defused';
    if (
      normalized.includes('explod')
      || normalized.includes('detonat')
      || normalized.includes('target_bombed')
    ) return 'bomb_exploded';
    if (
      normalized.includes('stopwatch')
      || normalized.includes('time')
      || normalized.includes('target_saved')
    ) return 'stopwatch';
    if (normalized.includes('ct') || normalized.includes('counter')) return 'ct_win';
    if (normalized === 't' || normalized === 't_win' || normalized.includes('terror')) return 't_win';
  }
  if (typeof winner === 'string') {
    const normalizedWinner = winner.trim().toLowerCase().replace(/[ -]/g, '_');
    if (normalizedWinner === 'ct' || normalizedWinner.includes('counter')) return 'ct_win';
    if (normalizedWinner === 't' || normalizedWinner.includes('terror')) return 't_win';
  }
  if (typeof winner === 'number' && ctTeamId !== undefined && terroristTeamId !== undefined) {
    if (winner === ctTeamId || winner === 1) return 'ct_win';
    if (winner === terroristTeamId || winner === 0) return 't_win';
  }
  return 'unknown';
}
