import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { ArticlePreview } from '../../shared/articleContracts.js';
import type { TikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import type { YoutubeCommentsPreview } from '../../shared/youtubeContracts.js';
import type { RequestExecutionContext } from './requestExecutionContext.js';

export type {
  TikTokComment,
  TikTokCommentsPreview,
} from '../../shared/tiktokContracts.js';
export type { YoutubeComment, YoutubeCommentsPreview } from '../../shared/youtubeContracts.js';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export type PreviewUseCase<TResult> = (
  input: string,
  context: RequestExecutionContext,
) => Promise<TResult>;

export interface PreviewUseCases {
  article: PreviewUseCase<ArticlePreview>;
  openGraph: PreviewUseCase<OpenGraphPreview>;
  liquipediaMatch: PreviewUseCase<LiquipediaMatchPreview>;
  tiktokComments: PreviewUseCase<TikTokCommentsPreview>;
  youtubeComments: PreviewUseCase<YoutubeCommentsPreview>;
  redditPreviewImage: PreviewUseCase<PreviewImage>;
}
