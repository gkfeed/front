import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';
import type { YoutubeCommentsPreview, YoutubeTimecodesPreview } from '../../../../shared/youtubeContracts';
import type { ArticlePreview, ArticleSummary } from '../../../../shared/articleContracts';

import type { RemotePreview, RemotePreviewSource } from '../../domain/feedItemCardContracts';

export type PreviewGateway = {
  getArticleSummary: (url: string, signal?: AbortSignal) => Promise<ArticleSummary>;
  getArticle: (url: string, signal?: AbortSignal) => Promise<ArticlePreview>;
  getOpenGraphPreview: (url: string, signal?: AbortSignal) => Promise<OpenGraphPreview>;
  fetchTikTokComments: (url: string, signal: AbortSignal) => Promise<TikTokCommentsPreview>;
  fetchYoutubeComments: (url: string, signal: AbortSignal) => Promise<YoutubeCommentsPreview>;
  fetchYoutubeTimecodes: (url: string, signal: AbortSignal) => Promise<YoutubeTimecodesPreview>;
  reprioritizeRemotePreview?: (url: string, source: Exclude<RemotePreviewSource, 'none'>, priority: number) => void;
  getCachedRemotePreview?: (url: string, source: Exclude<RemotePreviewSource, 'none'>) => RemotePreview | undefined;
  loadRemotePreview: (
    url: string,
    source: Exclude<RemotePreviewSource, 'none'>,
    signal: AbortSignal,
    priority?: number,
  ) => Promise<RemotePreview>;
};

export type PreviewUseCases = {
  loadArticleSummary: PreviewGateway['getArticleSummary'];
  loadArticle: PreviewGateway['getArticle'];
  loadOpenGraphPreview: PreviewGateway['getOpenGraphPreview'];
  loadTikTokComments: PreviewGateway['fetchTikTokComments'];
  loadYoutubeComments: PreviewGateway['fetchYoutubeComments'];
  loadYoutubeTimecodes: PreviewGateway['fetchYoutubeTimecodes'];
  loadRemotePreview: PreviewGateway['loadRemotePreview'];
  reprioritizeRemotePreview?: PreviewGateway['reprioritizeRemotePreview'];
  getCachedRemotePreview?: PreviewGateway['getCachedRemotePreview'];
};

export function createPreviewUseCases(gateway: PreviewGateway): PreviewUseCases {
  return {
    loadArticle: gateway.getArticle,
    loadArticleSummary: gateway.getArticleSummary,
    loadOpenGraphPreview: gateway.getOpenGraphPreview,
    loadTikTokComments: gateway.fetchTikTokComments,
    loadYoutubeComments: gateway.fetchYoutubeComments,
    loadYoutubeTimecodes: gateway.fetchYoutubeTimecodes,
    loadRemotePreview: gateway.loadRemotePreview,
    reprioritizeRemotePreview: gateway.reprioritizeRemotePreview,
    getCachedRemotePreview: gateway.getCachedRemotePreview,
  };
}
