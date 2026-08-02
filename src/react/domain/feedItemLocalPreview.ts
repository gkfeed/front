import type { FeedItem } from '../types';
import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type {
  FeedItemAnalysis,
  FeedItemPreview,
} from './feedItemPreviewTypes';
import { getEmbeddedPreview } from './embeddedPreview';
import { getFeedItemProviderFromUrl } from './feedItemProviders';
import { getTwitchChannel, getTwitchPreview } from './twitchPreview';
import { getVkVideoPreview } from './vkPreview';
import {
  getYoutubeVideoId,
  hostnameOf,
  isDirectImage,
  isDirectVideo,
  isDirectVideoValue,
  parseUrl,
} from './feedItemUrls';
import { getYoutubePreview } from './youtubePreview';

export { isGenericHltvPreview } from './hltvPreview';
export { getTikTokEmbedPreview } from './tiktokPreview';
export { getTwitchPreview } from './twitchPreview';
export { getVkVideoPreview } from './vkPreview';

export function analyzeFeedItem(item: FeedItem): FeedItemAnalysis {
  const url = parseUrl(item.link);
  return {
    url,
    hostname: url ? hostnameOf(url) : null,
    provider: getFeedItemProviderFromUrl(item, url),
    localPreview: getFeedItemPreviewFromUrl(item, url),
    youtubeVideoId: url ? getYoutubeVideoId(url) : null,
    twitchChannel: url ? getTwitchChannel(url) : null,
  };
}

export function getFeedItemPreview(item: FeedItem): FeedItemPreview | null {
  return getFeedItemPreviewFromUrl(item, parseUrl(item.link));
}

export function getRemoteFeedItemPreview(
  preview: OpenGraphPreview | null,
  title: string,
): FeedItemPreview | null {
  if (!preview) return null;
  const altTitle = preview.title || title;

  if (preview.video) {
    const videoUrl = parseUrl(preview.video);
    const vkVideoPreview = videoUrl ? getVkVideoPreview(videoUrl, altTitle) : null;
    if (vkVideoPreview) return vkVideoPreview;
  }

  if (preview.video && isDirectVideoValue(preview.video)) {
    return {
      src: preview.video,
      alt: { kind: 'video', title: altTitle || null },
      type: 'video',
      ...(preview.image ? { poster: preview.image } : {}),
    };
  }

  return preview.image ? {
    src: preview.image,
    alt: { kind: 'item', title: altTitle || null },
  } : null;
}

function getFeedItemPreviewFromUrl(item: FeedItem, url: URL | null): FeedItemPreview | null {
  if (!url) return getEmbeddedPreview(item.text, item.title);

  const vkVideoEmbed = getVkVideoPreview(url, item.title);
  if (vkVideoEmbed) return vkVideoEmbed;

  if (isDirectImage(url)) {
    return { src: url.href, alt: { kind: 'item', title: item.title || null } };
  }

  if (isDirectVideo(url)) {
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
