import { PreviewError } from './errors.js';

const MAX_ACTIVE_PREVIEWS = 32;
let activePreviews = 0;

export async function withPreviewLimit<T>(load: () => Promise<T>): Promise<T> {
  if (activePreviews >= MAX_ACTIVE_PREVIEWS) {
    throw new PreviewError('Too many preview requests are in progress', 'preview_busy');
  }

  activePreviews += 1;
  try {
    return await load();
  } finally {
    activePreviews -= 1;
  }
}
