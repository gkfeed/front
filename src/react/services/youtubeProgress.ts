import { readMediaProgress, writeMediaProgress } from './mediaProgress';
import type { MediaProgress } from './mediaProgress';

const YOUTUBE_PROGRESS_STORAGE_PREFIX = 'gkfeed.youtube-progress.v1';

export type YoutubeProgress = MediaProgress;

export function readYoutubeProgress(videoId: string): YoutubeProgress | null {
  return readMediaProgress(YOUTUBE_PROGRESS_STORAGE_PREFIX, videoId);
}

export function writeYoutubeProgress(
  videoId: string,
  position: number,
  duration: number,
): void {
  writeMediaProgress(YOUTUBE_PROGRESS_STORAGE_PREFIX, videoId, position, duration);
}
