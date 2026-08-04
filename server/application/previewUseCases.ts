import type { RequestContext } from '../requestContext.js';
import { fetchTikTokComments } from '../tiktok.js';
import { fetchLiquipediaMatch } from '../preview/liquipedia.js';
import { fetchOpenGraph } from '../preview/openGraph.js';
import { fetchRedditPreviewImage, type PreviewImage } from '../preview/reddit.js';
import { withPreviewLimit } from '../preview/previewLimiter.js';

type PreviewInput = (input: string, context: RequestContext) => Promise<unknown>;

export type PreviewUseCases = {
  openGraph(input: string, context: RequestContext): Promise<unknown>;
  liquipediaMatch(input: string, context: RequestContext): Promise<unknown>;
  tiktokComments(input: string, context: RequestContext): Promise<unknown>;
  redditPreviewImage(input: string, context: RequestContext): Promise<PreviewImage>;
};

export type PreviewPorts = {
  fetchOpenGraph: PreviewInput;
  fetchLiquipediaMatch: PreviewInput;
  fetchTikTokComments: PreviewInput;
  fetchRedditPreviewImage: (input: string, context: RequestContext) => Promise<PreviewImage>;
};

const infrastructurePorts: PreviewPorts = {
  fetchOpenGraph,
  fetchLiquipediaMatch,
  fetchTikTokComments,
  fetchRedditPreviewImage,
};

export function createPreviewUseCases(ports: PreviewPorts = infrastructurePorts): PreviewUseCases {
  return {
    openGraph: withLimit(ports.fetchOpenGraph),
    liquipediaMatch: withLimit(ports.fetchLiquipediaMatch),
    tiktokComments: withLimit(ports.fetchTikTokComments),
    redditPreviewImage: withLimit(ports.fetchRedditPreviewImage),
  };
}

export const previewUseCases = createPreviewUseCases();

function withLimit<T>(
  load: (input: string, context: RequestContext) => Promise<T>,
): (input: string, context: RequestContext) => Promise<T> {
  return (input, context) => withPreviewLimit(() => load(input, context));
}
