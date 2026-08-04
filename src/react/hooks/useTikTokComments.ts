import { useCallback } from 'react';

import type { TikTokCommentsPreview } from '../../../shared/tiktokContracts';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useAsyncResource } from './useAsyncResource';

export type TikTokCommentsLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export function useTikTokComments(link: string, enabled: boolean) {
  const { preview } = useFeatureUseCases();
  const load = useCallback(
    (signal: AbortSignal) => preview.fetchTikTokComments(link, signal),
    [link, preview],
  );
  const {
    status,
    result,
    retry: retryResource,
  } = useAsyncResource<TikTokCommentsPreview>(load, { enabled, key: link });
  const typedStatus: TikTokCommentsLoadStatus = status;
  const retry = useCallback(() => {
    retryResource();
  }, [retryResource]);

  return {
    status: typedStatus,
    comments: result?.comments ?? null,
    remoteDescription: result?.description ?? null,
    creator: result?.creatorName ? {
      name: result.creatorName,
      avatarUrl: result.creatorAvatarUrl,
    } : null,
    isLoading: typedStatus === 'loading',
    loadFailed: typedStatus === 'error',
    retry,
  };
}
