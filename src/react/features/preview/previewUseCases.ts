import type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';
import type { PreviewApplicationPort } from '../featurePorts';

export type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';

export function createPreviewUseCases(port: PreviewApplicationPort) {
  return {
    getArticle: port.getArticle,
    EMPTY_REMOTE_PREVIEW: port.EMPTY_REMOTE_PREVIEW,
    fetchTikTokComments: (url: string, signal: AbortSignal): Promise<TikTokCommentsPreview> => (
      port.fetchTikTokComments(url, signal)
    ),
    getOpenGraphPreview: port.getOpenGraphPreview,
    loadRemotePreview: port.loadRemotePreview,
    mergeHltvLiveData: port.mergeHltvLiveData,
  };
}
