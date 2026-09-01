import type { FeedItem } from '../types';
import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getEmbeddedPreview } from './embeddedPreview';
import { getFeedItemProviderFromUrl } from './feedItemProviderPresentation';
import { getShikimoriHighQualityImageUrl } from './shikimoriPreview';
import { getTwitchPreview } from './twitchPreview';
import { getVkVideoPreview } from './vkPreview';
import {
  isDirectImage,
  isDirectVideo,
  isRedditVideoUrl,
  parseUrl,
} from './feedItemUrls';
import { getYoutubePreview } from './youtubePreview';
import { isInstagramMediaUrl } from './instagramPreview';

export function getFeedItemPreview(item: FeedItem): FeedItemPreview | null {
  return getFeedItemPreviewFromUrl(item, parseUrl(item.link));
}

function getFeedItemPreviewFromUrl(item: FeedItem, url: URL | null): FeedItemPreview | null {
  if (!url) return getEmbeddedPreview(item.text, item.title);

  const vkVideoEmbed = getVkVideoPreview(url, item.title);
  if (vkVideoEmbed) return vkVideoEmbed;

  if (isDirectImage(url)) {
    return {
      src: getShikimoriHighQualityImageUrl(url.href),
      alt: { kind: 'item', title: item.title || null },
    };
  }

  if (isRedditVideoUrl(url)) {
    return {
      src: url.href,
      alt: { kind: 'video', title: item.title || null },
      type: 'video',
    };
  }

  if (isDirectVideo(url)) {
    return {
      src: url.href,
      alt: { kind: 'video', title: item.title || null },
      type: 'video',
    };
  }

  // Imported Instagram stories can use extensionless download endpoints (for
  // example, tempfile.org/.../download). The `inst:` marker is the only media
  // type information available in those feed items.
  if (
    getFeedItemProviderFromUrl(item, url) === 'instagram'
    && !isInstagramMediaUrl(url)
    && (url.protocol === 'http:' || url.protocol === 'https:')
  ) {
    return {
      src: url.href,
      alt: { kind: 'video', title: item.title || null },
      type: 'video',
    };
  }

  const twitchPreview = getTwitchPreview(url);
  if (twitchPreview) return twitchPreview;

  const youtubePreview = getYoutubePreview(url, item.title);
  if (youtubePreview) return youtubePreview;

  return getEmbeddedPreview(item.text, item.title);
}
