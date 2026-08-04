import type { PreviewApplicationPort, TikTokCommentsResult } from '../featurePorts';

export type { TikTokCommentsResult } from '../featurePorts';

export function createPreviewUseCases(port: PreviewApplicationPort) {
  return {
    EMPTY_REMOTE_PREVIEW: port.EMPTY_REMOTE_PREVIEW,
    fetchTikTokComments: (url: string, signal: AbortSignal): Promise<TikTokCommentsResult> => (
      port.fetchTikTokComments(url, signal)
    ),
    getOpenGraphPreview: port.getOpenGraphPreview,
    loadRemotePreview: port.loadRemotePreview,
    mergeHltvLiveData: port.mergeHltvLiveData,
  };
}
