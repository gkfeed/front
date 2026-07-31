import { getObjectProperty } from '../unknownObject';
import type { ReviewQueueState } from './reviewQueue';

const REVIEW_STATE_STORAGE_PREFIX = 'gkfeed.reader-review.v1';

export function getReviewStateStorageKey(username: string): string {
  return `${REVIEW_STATE_STORAGE_PREFIX}.${encodeURIComponent(username)}`;
}

export function readReviewState(
  storageKey: string | null,
  availableIds: number[],
): ReviewQueueState | null {
  const storage = getReviewStorage();
  if (!storageKey || !storage) return null;

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) return null;
    const parsed: unknown = JSON.parse(rawValue);
    if (getObjectProperty(parsed, 'version') !== 1) return null;

    const pendingIds = parseIds(getObjectProperty(parsed, 'pendingIds'));
    const revisitIds = parseIds(getObjectProperty(parsed, 'revisitIds'));
    const keptIds = parseIds(getObjectProperty(parsed, 'keptItemIds'));
    if (!pendingIds || !revisitIds || !keptIds) return null;

    const available = new Set(availableIds);
    const keptItemIds = new Set(keptIds.filter((id) => available.has(id)));
    const filteredPendingIds = uniqueIds(
      pendingIds.filter((id) => available.has(id) && !keptItemIds.has(id)),
    );
    const filteredRevisitIds = uniqueIds(
      revisitIds.filter((id) => available.has(id) && keptItemIds.has(id)),
    );
    const knownIds = new Set([
      ...filteredPendingIds,
      ...filteredRevisitIds,
      ...keptItemIds,
    ]);
    const newIds = availableIds
      .filter((id) => !knownIds.has(id))
      .sort((left, right) => right - left);

    return {
      pendingIds: [...newIds, ...filteredPendingIds],
      revisitIds: filteredRevisitIds,
      keptItemIds,
    };
  } catch {
    return null;
  }
}

export function writeReviewState(storageKey: string | null, state: ReviewQueueState): void {
  const storage = getReviewStorage();
  if (!storageKey || !storage) return;

  try {
    storage.setItem(storageKey, JSON.stringify({
      version: 1,
      pendingIds: state.pendingIds,
      revisitIds: state.revisitIds,
      keptItemIds: [...state.keptItemIds],
    }));
  } catch {
    // Keep the current review session usable if storage is unavailable.
  }
}

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return uniqueIds(value.filter(isSafeId));
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function isSafeId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function getReviewStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
