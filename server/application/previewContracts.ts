import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { RequestContext } from '../requestContext.js';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export interface TikTokComment {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
}

export interface TikTokCommentsPreview {
  comments: TikTokComment[];
  description: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
}

export type PreviewUseCase<TResult> = (
  input: string,
  context: RequestContext,
) => Promise<TResult>;

export interface PreviewUseCases {
  openGraph: PreviewUseCase<OpenGraphPreview>;
  liquipediaMatch: PreviewUseCase<LiquipediaMatchPreview>;
  tiktokComments: PreviewUseCase<TikTokCommentsPreview>;
  redditPreviewImage: PreviewUseCase<PreviewImage>;
}
