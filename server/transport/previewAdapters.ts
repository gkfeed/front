import { fetchTikTokPlayback } from '../tiktokPlayback.js';
import { fetchTikTokComments } from '../tiktok.js';
import { fetchYoutubeComments } from '../youtubeComments.js';
import { fetchYoutubeTimecodes } from '../youtubeTimecodes.js';
import { fetchLiquipediaMatch } from '../preview/liquipedia.js';
import { fetchOpenGraph } from '../preview/openGraph.js';
import { fetchRedditPreviewImage } from '../preview/reddit.js';
import { fetchArticle } from '../preview/article.js';
import type { PreviewPorts } from '../application/previewPorts.js';
import { fetchHltvLiveIndex } from '../preview/hltvLiveIndex.js';
import { fetchVkVideoSource, fetchVkVideoStream } from '../preview/vkVideo.js';
import { fetchSasflixMedia } from '../preview/sasflixMedia.js';

export const previewProviderPorts: PreviewPorts = {
  fetchArticle,
  fetchOpenGraph,
  fetchLiquipediaMatch,
  fetchTikTokPlayback,
  fetchTikTokComments,
  fetchYoutubeComments,
  fetchYoutubeTimecodes,
  fetchRedditPreviewImage,
  fetchSasflixMedia,
  fetchVkVideoSource,
  fetchVkVideoStream,
  fetchHltvLiveIndex,
};
