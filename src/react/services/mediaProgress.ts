const MINIMUM_RESUME_SECONDS = 5;
const COMPLETION_END_MARGIN_SECONDS = 30;

export type MediaProgress = {
  position: number;
  duration: number;
  updatedAt: number;
};

export function readMediaProgress(storagePrefix: string, mediaId: string): MediaProgress | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const progress = readStoredProgress(storage, getProgressStorageKey(storagePrefix, mediaId));
    if (!progress) return null;
    if (progress.position < MINIMUM_RESUME_SECONDS) return null;
    if (progress.position >= progress.duration - COMPLETION_END_MARGIN_SECONDS) return null;
    return progress;
  } catch {
    return null;
  }
}

export function writeMediaProgress(
  storagePrefix: string,
  mediaId: string,
  position: number,
  duration: number,
): void {
  const storage = getStorage();
  if (!storage || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;

  try {
    const storageKey = getProgressStorageKey(storagePrefix, mediaId);
    if (
      position < MINIMUM_RESUME_SECONDS
      || position >= duration
      || position >= duration - COMPLETION_END_MARGIN_SECONDS
    ) {
      storage.removeItem(storageKey);
      return;
    }

    storage.setItem(storageKey, JSON.stringify({
      position,
      duration,
      updatedAt: Date.now(),
    } satisfies MediaProgress));
  } catch {
    // Keep media playback usable if storage is unavailable.
  }
}

function getProgressStorageKey(storagePrefix: string, mediaId: string): string {
  return `${storagePrefix}.${encodeURIComponent(mediaId)}`;
}

function readStoredProgress(storage: Storage, storageKey: string): MediaProgress | null {
  const rawValue = storage.getItem(storageKey);
  if (!rawValue) return null;
  const parsed: unknown = JSON.parse(rawValue);
  return isProgress(parsed) ? parsed : null;
}

function isProgress(value: unknown): value is MediaProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Record<string, unknown>;
  return typeof progress.position === 'number'
    && Number.isFinite(progress.position)
    && typeof progress.duration === 'number'
    && Number.isFinite(progress.duration)
    && progress.duration > 0
    && typeof progress.updatedAt === 'number'
    && Number.isFinite(progress.updatedAt);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
