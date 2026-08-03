const YOUTUBE_PROGRESS_STORAGE_PREFIX = 'gkfeed.youtube-progress.v1';
const MINIMUM_RESUME_SECONDS = 5;
const COMPLETION_END_MARGIN_SECONDS = 30;

export type YoutubeProgress = {
  position: number;
  duration: number;
  updatedAt: number;
};

export function readYoutubeProgress(videoId: string): YoutubeProgress | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(getYoutubeProgressStorageKey(videoId));
    if (!rawValue) return null;
    const parsed: unknown = JSON.parse(rawValue);
    if (!isProgress(parsed)) return null;
    if (parsed.position < MINIMUM_RESUME_SECONDS) return null;
    if (parsed.position >= parsed.duration - COMPLETION_END_MARGIN_SECONDS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeYoutubeProgress(
  videoId: string,
  position: number,
  duration: number,
): void {
  const storage = getStorage();
  if (!storage || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;

  try {
    const storageKey = getYoutubeProgressStorageKey(videoId);
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
    } satisfies YoutubeProgress));
  } catch {
    // Keep video playback usable if storage is unavailable.
  }
}

function getYoutubeProgressStorageKey(videoId: string): string {
  return `${YOUTUBE_PROGRESS_STORAGE_PREFIX}.${encodeURIComponent(videoId)}`;
}

function isProgress(value: unknown): value is YoutubeProgress {
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
