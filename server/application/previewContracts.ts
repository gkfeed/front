import type { Readable } from 'node:stream';

import type { TikTokPlaybackPreview } from '../../shared/tiktokContracts.js';
import type {
  HltvLiveIndex,
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

export interface VkVideoSource {
  url: string;
  referer: string;
}

export interface PreviewVideo {
  body: Readable;
  status: 200 | 206;
  contentType: string;
  acceptRanges: string;
  contentLength?: string;
  contentRange?: string;
}

export type PreviewUseCase<TResult> = (
  input: string,
  context: RequestExecutionContext,
) => Promise<TResult>;

export interface PreviewUseCases {
  article: PreviewUseCase<ArticlePreview>;
  openGraph: PreviewUseCase<OpenGraphPreview>;
  liquipediaMatch: PreviewUseCase<LiquipediaMatchPreview>;
  tiktokPlayback: PreviewUseCase<TikTokPlaybackPreview>;
  tiktokComments: PreviewUseCase<TikTokCommentsPreview>;
  youtubeComments: PreviewUseCase<YoutubeCommentsPreview>;
  redditPreviewImage: PreviewUseCase<PreviewImage>;
  sasflixMedia: (
    input: string,
    range: string | undefined,
    context: RequestExecutionContext,
  ) => Promise<PreviewVideo>;
  vkVideoSource: PreviewUseCase<VkVideoSource>;
  vkVideoStream: (
    source: VkVideoSource,
    range: string | undefined,
    context: RequestExecutionContext,
  ) => Promise<PreviewVideo>;
  hltvLiveIndex: (
    context: RequestExecutionContext,
  ) => Promise<HltvLiveIndex>;
}
