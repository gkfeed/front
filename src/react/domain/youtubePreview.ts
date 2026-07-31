import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getYoutubeVideoId } from './feedItemUrls';

export function getYoutubePreview(url: URL, title: string): FeedItemPreview | null {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  return {
    src: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`,
    fallbackSrc: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    alt: { kind: 'youtube', title: title || null },
  };
}
