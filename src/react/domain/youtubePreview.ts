import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getYoutubeVideoId } from './feedItemUrls';

export function getYoutubePreview(url: URL, title: string): FeedItemPreview | null {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) return null;

  return {
    src: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`,
    // hqdefault is 4:3 and letterboxes widescreen videos. mqdefault keeps the
    // same 16:9 shape as the player when maxresdefault is unavailable.
    fallbackSrc: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`,
    alt: { kind: 'youtube', title: title || null },
  };
}
