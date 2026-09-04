import type {
  PreviewConcurrencyLimiter,
  PreviewPort,
  PreviewPorts,
} from './previewPorts.js';
import type { PreviewUseCases } from './previewContracts.js';

export function createPreviewUseCases(
  ports: PreviewPorts,
  limit: PreviewConcurrencyLimiter = withoutLimit,
): PreviewUseCases {
  return {
    article: withLimit(ports.fetchArticle, limit),
    openGraph: withLimit(ports.fetchOpenGraph, limit),
    liquipediaMatch: withLimit(ports.fetchLiquipediaMatch, limit),
    tiktokComments: withLimit(ports.fetchTikTokComments, limit),
    youtubeComments: withLimit(ports.fetchYoutubeComments, limit),
    redditPreviewImage: withLimit(ports.fetchRedditPreviewImage, limit),
  };
}

function withLimit<TResult>(
  load: PreviewPort<TResult>,
  limit: PreviewConcurrencyLimiter,
): PreviewPort<TResult> {
  return (input, context) => limit(() => load(input, context));
}

async function withoutLimit<TResult>(load: () => Promise<TResult>): Promise<TResult> {
  return load();
}
