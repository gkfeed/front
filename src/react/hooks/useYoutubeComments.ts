import { useCallback } from 'react';

import type { YoutubeCommentsPreview } from '../../../shared/youtubeContracts';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useAsyncResource } from './useAsyncResource';

export function useYoutubeComments(videoId: string, enabled: boolean) {
  const { preview } = useFeatureUseCases();
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const load = useCallback(
    (signal: AbortSignal) => preview.loadYoutubeComments(url, signal),
    [preview, url],
  );
  const { status, result, retry } = useAsyncResource<YoutubeCommentsPreview>(load, {
    enabled,
    key: videoId,
  });
  return { status, comments: result?.comments ?? null, retry };
}
