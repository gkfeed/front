import type { HltvLiveIndex } from '../../../shared/previewContracts';
import { requestBffJson } from './bffClient';

export async function getHltvLiveIndex(signal?: AbortSignal): Promise<HltvLiveIndex> {
  return requestBffJson({
    endpoint: '/bff/hltv-live',
    input: '',
    resourceName: 'HLTV live index',
    validate: isHltvLiveIndex,
    signal,
  });
}

function isHltvLiveIndex(value: unknown): value is HltvLiveIndex {
  if (typeof value !== 'object' || value === null) return false;
  const eventIds = (value as Partial<HltvLiveIndex>).eventIds;
  return Array.isArray(eventIds) && eventIds.every((id) => typeof id === 'string' && /^\d+$/.test(id));
}
