import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { ArticlePreview } from '../../shared/articleContracts.js';
import type { TikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import type { RequestExecutionContext } from './requestExecutionContext.js';

export type {
  TikTokComment,
  TikTokCommentsPreview,
} from '../../shared/tiktokContracts.js';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export interface PreviewRedirect {
  url: string;
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
  tiktokVideo: PreviewUseCase<PreviewRedirect>;
  redditPreviewImage: PreviewUseCase<PreviewImage>;
}
