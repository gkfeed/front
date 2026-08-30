import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';
import type { ArticlePreview } from '../../../../shared/articleContracts';

import type { RemotePreview } from '../../domain/feedItemCardContracts';

export type PreviewGateway = {
  getArticle: (url: string, signal?: AbortSignal) => Promise<ArticlePreview>;
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
  fetchTikTokComments: (url: string, signal: AbortSignal) => Promise<TikTokCommentsPreview>;
  loadRemotePreview: (
    url: string,
    isLiquipedia: boolean,
    signal: AbortSignal,
  ) => Promise<RemotePreview>;
};

export type PreviewUseCases = {
  loadArticle: PreviewGateway['getArticle'];
  loadOpenGraphPreview: PreviewGateway['getOpenGraphPreview'];
  loadTikTokComments: PreviewGateway['fetchTikTokComments'];
  loadRemotePreview: PreviewGateway['loadRemotePreview'];
};

export function createPreviewUseCases(gateway: PreviewGateway): PreviewUseCases {
  return {
    loadArticle: gateway.getArticle,
    loadOpenGraphPreview: gateway.getOpenGraphPreview,
    loadTikTokComments: gateway.fetchTikTokComments,
    loadRemotePreview: gateway.loadRemotePreview,
  };
}
