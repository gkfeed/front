import { isOneFootballProviderData, type OneFootballMatchSnapshot } from './oneFootball.js';
import { isRecord } from '../valueGuards.js';

export type LiveballProviderData = { provider: 'liveball'; snapshot: OneFootballMatchSnapshot };
export function isLiveballProviderData(value: unknown): value is LiveballProviderData {
  return isRecord(value) && value.provider === 'liveball'
    && isOneFootballProviderData({ provider: 'onefootball', snapshot: value.snapshot });
}
export function getLiveballSnapshot(value: unknown): OneFootballMatchSnapshot | null {
  return isLiveballProviderData(value) ? value.snapshot : null;
}
