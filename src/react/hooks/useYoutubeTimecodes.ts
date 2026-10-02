import { useCallback } from 'react';

import type { YoutubeTimecodesPreview } from '../../../shared/youtubeContracts';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useAsyncResource } from './useAsyncResource';

export function useYoutubeTimecodes(videoId: string, enabled: boolean) {
  const { preview } = useFeatureUseCases();
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const load = useCallback(
    (signal: AbortSignal) => preview.loadYoutubeTimecodes(url, signal),
    [preview, url],
  );
  const { status, result, retry } = useAsyncResource<YoutubeTimecodesPreview>(load, {
    enabled,
    key: videoId,
  });
  return { status, timecodes: result?.timecodes ?? null, retry };
}
