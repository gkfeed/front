import { readMediaProgress, writeMediaProgress } from './mediaProgress';

const SASFLIX_PROGRESS_STORAGE_PREFIX = 'gkfeed.sasflix-progress.v1';

export function readSasflixProgress(publicationId: string) {
  return readMediaProgress(SASFLIX_PROGRESS_STORAGE_PREFIX, publicationId);
}

export function writeSasflixProgress(
  publicationId: string,
  position: number,
  duration: number,
): void {
  writeMediaProgress(SASFLIX_PROGRESS_STORAGE_PREFIX, publicationId, position, duration);
}
