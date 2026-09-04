import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';
import type { YoutubeCommentsPreview } from '../../../../shared/youtubeContracts';
import type { ArticlePreview } from '../../../../shared/articleContracts';

import type { RemotePreview, RemotePreviewSource } from '../../domain/feedItemCardContracts';

export type PreviewGateway = {
  getArticle: (url: string, signal?: AbortSignal) => Promise<ArticlePreview>;
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
  fetchTikTokComments: (url: string, signal: AbortSignal) => Promise<TikTokCommentsPreview>;
  fetchYoutubeComments: (url: string, signal: AbortSignal) => Promise<YoutubeCommentsPreview>;
  loadRemotePreview: (
    url: string,
    source: Exclude<RemotePreviewSource, 'none'>,
    signal: AbortSignal,
  ) => Promise<RemotePreview>;
};

export type PreviewUseCases = {
  loadArticle: PreviewGateway['getArticle'];
  loadOpenGraphPreview: PreviewGateway['getOpenGraphPreview'];
  loadTikTokComments: PreviewGateway['fetchTikTokComments'];
  loadYoutubeComments: PreviewGateway['fetchYoutubeComments'];
  loadRemotePreview: PreviewGateway['loadRemotePreview'];
};

export function createPreviewUseCases(gateway: PreviewGateway): PreviewUseCases {
  return {
    loadArticle: gateway.getArticle,
    loadOpenGraphPreview: gateway.getOpenGraphPreview,
    loadTikTokComments: gateway.fetchTikTokComments,
    loadYoutubeComments: gateway.fetchYoutubeComments,
    loadRemotePreview: gateway.loadRemotePreview,
  };
}
