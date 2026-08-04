import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type {
  PreviewImage,
  TikTokCommentsPreview,
} from './previewContracts.js';
import type { RequestContext } from '../requestContext.js';

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
