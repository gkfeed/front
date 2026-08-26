import type { FeedItem } from '../types';
import type { FeedItemPreview } from './feedItemPreviewTypes';
import { parseUrl } from './feedItemUrls';

export type TikTokPreviewMode = 'embed' | 'broker';

export function getTikTokEmbedPreview(item: FeedItem): FeedItemPreview | null {
  const url = parseUrl(item.link);
  const videoId = url?.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  const parameters = new URLSearchParams({
    autoplay: '1',
    muted: '0',
    loop: '1',
    controls: '1',
    music_info: '0',
    description: '0',
    rel: '0',
  });
  return {
    src: `https://www.tiktok.com/player/v1/${videoId}?${parameters}`,
    alt: { kind: 'tiktok', title: item.title || null },
    type: 'embed',
  };
}

export function getTikTokBrokerPreview(item: FeedItem): FeedItemPreview | null {
  const url = parseUrl(item.link);
  const videoId = url?.pathname.match(/\/(?:video|v)\/(\d+)/)?.[1];
  if (!url || !videoId) return null;

  return {
    src: `/bff/tiktok-video?url=${encodeURIComponent(url.href)}`,
    alt: { kind: 'tiktok', title: item.title || null },
    type: 'video',
  };
}
