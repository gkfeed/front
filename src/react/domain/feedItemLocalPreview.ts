import type { FeedItem } from '../types';
import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getEmbeddedPreview } from './embeddedPreview';
import {
  getFeedItemProviderFromUrl,
  type FeedPluginId,
} from './feedItemProviderPresentation';
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

export function getFeedItemPreview(
  item: FeedItem,
  disabledPlugins: ReadonlySet<FeedPluginId> = new Set(),
): FeedItemPreview | null {
  return getFeedItemPreviewFromUrl(item, parseUrl(item.link), disabledPlugins);
}

function getFeedItemPreviewFromUrl(
  item: FeedItem,
  url: URL | null,
  disabledPlugins: ReadonlySet<FeedPluginId>,
): FeedItemPreview | null {
  if (!url) return getEmbeddedPreview(item.text, item.title);
  const provider = getFeedItemProviderFromUrl(item, url, disabledPlugins);

  const vkVideoEmbed = provider === 'vk' ? getVkVideoPreview(url, item.title) : null;
  if (vkVideoEmbed) return vkVideoEmbed;

  if (isDirectImage(url)) {
    return {
      src: getShikimoriHighQualityImageUrl(url.href),
      alt: { kind: 'item', title: item.title || null },
    };
  }

  if (provider === 'reddit' && isRedditVideoUrl(url)) {
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
    provider === 'instagram'
    && !isInstagramMediaUrl(url)
    && (url.protocol === 'http:' || url.protocol === 'https:')
  ) {
    return {
      src: url.href,
      alt: { kind: 'video', title: item.title || null },
      type: 'video',
    };
  }

  const twitchPreview = provider === 'twitch' ? getTwitchPreview(url) : null;
  if (twitchPreview) return twitchPreview;

  const youtubePreview = provider === 'youtube' ? getYoutubePreview(url, item.title) : null;
  if (youtubePreview) return youtubePreview;

  return getEmbeddedPreview(item.text, item.title);
}
