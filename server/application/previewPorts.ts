import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { ArticlePreview } from '../../shared/articleContracts.js';
import type {
  PreviewImage,
  TikTokCommentsPreview,
} from './previewContracts.js';
import type { YoutubeCommentsPreview } from '../../shared/youtubeContracts.js';
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
  fetchYoutubeComments: PreviewPort<YoutubeCommentsPreview>;
  fetchRedditPreviewImage: PreviewPort<PreviewImage>;
}

export type PreviewConcurrencyLimiter = <T>(load: () => Promise<T>) => Promise<T>;
