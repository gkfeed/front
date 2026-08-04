import { fetchTikTokComments } from '../tiktok.js';
import { fetchLiquipediaMatch } from '../preview/liquipedia.js';
import { fetchOpenGraph } from '../preview/openGraph.js';
import { fetchRedditPreviewImage } from '../preview/reddit.js';
import { withPreviewLimit } from '../preview/previewLimiter.js';
import { createPreviewUseCases } from '../application/previewUseCaseFactory.js';
import type { PreviewPorts } from '../application/previewPorts.js';

export const previewProviderPorts: PreviewPorts = {
  fetchOpenGraph,
  fetchLiquipediaMatch,
  fetchTikTokComments,
  fetchRedditPreviewImage,
};

export const previewUseCases = createPreviewUseCases(previewProviderPorts, withPreviewLimit);
