import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { ArticlePreview } from '../../shared/articleContracts.js';
import type {
  PreviewImage,
  PreviewRedirect,
  TikTokCommentsPreview,
} from './previewContracts.js';
import type { RequestExecutionContext } from './requestExecutionContext.js';

export type PreviewPort<TResult> = (
  input: string,
  context: RequestExecutionContext,
) => Promise<TResult>;

export interface PreviewPorts {
  fetchArticle: PreviewPort<ArticlePreview>;
  fetchOpenGraph: PreviewPort<OpenGraphPreview>;
  fetchLiquipediaMatch: PreviewPort<LiquipediaMatchPreview>;
  fetchTikTokComments: PreviewPort<TikTokCommentsPreview>;
  fetchTikTokVideo: PreviewPort<PreviewRedirect>;
  fetchRedditPreviewImage: PreviewPort<PreviewImage>;
}

export type PreviewConcurrencyLimiter = <T>(load: () => Promise<T>) => Promise<T>;
