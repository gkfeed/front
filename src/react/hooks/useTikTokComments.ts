import { useCallback } from 'react';

import { featureUseCases } from '../application/featureComposition';
import type { TikTokCommentsResult } from '../features/featurePorts';
import { useAsyncResource } from './useAsyncResource';

export type TikTokCommentsLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export function useTikTokComments(link: string, enabled: boolean) {
  const load = useCallback(
    (signal: AbortSignal) => featureUseCases.preview.fetchTikTokComments(link, signal),
    [link],
  );
  const {
    status,
    result,
    retry: retryResource,
  } = useAsyncResource<TikTokCommentsResult>(load, { enabled, key: link });
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
