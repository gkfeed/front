import type { FeedItem } from '../types';
import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type {
  FeedItemAnalysis,
  FeedItemPreview,
} from './feedItemPreviewTypes';
import { getEmbeddedPreview } from './embeddedPreview';
import { getFeedItemProviderFromUrl } from './feedItemProviderDetection';
import { getShikimoriHighQualityImageUrl } from './shikimoriPreview';
import { getTwitchChannel, getTwitchPreview } from './twitchPreview';
import { getVkVideoPreview } from './vkPreview';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  hostnameOf,
  isDirectImage,
  isDirectVideo,
  isDirectVideoValue,
  isRedditVideoUrl,
  parseUrl,
} from './feedItemUrls';
import { getYoutubePreview } from './youtubePreview';
import { isInstagramMediaUrl } from './instagramPreview';

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
    matreshkaVideoId: url ? getMatreshkaVideoId(url) : null,
    sasflixPublicationId: url ? getSasflixPublicationId(url) : null,
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
    if (videoUrl && isRedditVideoUrl(videoUrl)) {
      return {
        src: videoUrl.href,
        alt: { kind: 'video', title: altTitle || null },
        type: 'video',
        ...(preview.image ? { poster: preview.image } : {}),
      };
    }
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
