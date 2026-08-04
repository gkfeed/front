import type {
  PreviewConcurrencyLimiter,
  PreviewPort,
  PreviewPorts,
  PreviewUseCases,
} from './previewPorts.js';

export function createPreviewUseCases(
  ports: PreviewPorts,
  limit: PreviewConcurrencyLimiter = withoutLimit,
): PreviewUseCases {
  return {
    openGraph: withLimit(ports.fetchOpenGraph, limit),
    liquipediaMatch: withLimit(ports.fetchLiquipediaMatch, limit),
    tiktokComments: withLimit(ports.fetchTikTokComments, limit),
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
