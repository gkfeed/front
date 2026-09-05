import { fetchTikTokComments } from '../tiktok.js';
import { fetchYoutubeComments } from '../youtubeComments.js';
import { fetchLiquipediaMatch } from '../preview/liquipedia.js';
import { fetchOpenGraph } from '../preview/openGraph.js';
import { fetchRedditPreviewImage } from '../preview/reddit.js';
import { fetchArticle } from '../preview/article.js';
import type { PreviewPorts } from '../application/previewPorts.js';
import { fetchHltvLiveIndex } from '../preview/hltvLiveIndex.js';

export const previewProviderPorts: PreviewPorts = {
  fetchArticle,
  fetchOpenGraph,
  fetchLiquipediaMatch,
  fetchTikTokComments,
  fetchYoutubeComments,
  fetchRedditPreviewImage,
  fetchHltvLiveIndex,
};
