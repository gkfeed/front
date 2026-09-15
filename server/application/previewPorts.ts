import type { TikTokPlaybackPreview } from '../../shared/tiktokContracts.js';
import type {
  HltvLiveIndex,
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import type { ArticlePreview } from '../../shared/articleContracts.js';
import type {
  PreviewImage,
  PreviewVideo,
  TikTokCommentsPreview,
  VkVideoSource,
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
  fetchTikTokPlayback: PreviewPort<TikTokPlaybackPreview>;
  fetchTikTokComments: PreviewPort<TikTokCommentsPreview>;
  fetchYoutubeComments: PreviewPort<YoutubeCommentsPreview>;
  fetchRedditPreviewImage: PreviewPort<PreviewImage>;
  fetchSasflixMedia: (
    input: string,
    range: string | undefined,
    context: RequestExecutionContext,
  ) => Promise<PreviewVideo>;
  fetchVkVideoSource: PreviewPort<VkVideoSource>;
  fetchVkVideoStream: (
    source: VkVideoSource,
    range: string | undefined,
    context: RequestExecutionContext,
  ) => Promise<PreviewVideo>;
  fetchHltvLiveIndex: (
    context: RequestExecutionContext,
  ) => Promise<HltvLiveIndex>;
}

export type PreviewConcurrencyLimiter = <T>(load: () => Promise<T>) => Promise<T>;
