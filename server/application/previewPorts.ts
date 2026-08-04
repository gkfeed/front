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

export type PreviewPort<TResult> = (
  input: string,
  context: RequestContext,
) => Promise<TResult>;

export interface PreviewPorts {
  fetchOpenGraph: PreviewPort<OpenGraphPreview>;
  fetchLiquipediaMatch: PreviewPort<LiquipediaMatchPreview>;
  fetchTikTokComments: PreviewPort<TikTokCommentsPreview>;
  fetchRedditPreviewImage: PreviewPort<PreviewImage>;
}

export type PreviewConcurrencyLimiter = <T>(load: () => Promise<T>) => Promise<T>;

export interface PreviewUseCases {
  openGraph: PreviewPort<OpenGraphPreview>;
  liquipediaMatch: PreviewPort<LiquipediaMatchPreview>;
  tiktokComments: PreviewPort<TikTokCommentsPreview>;
  redditPreviewImage: PreviewPort<PreviewImage>;
}
