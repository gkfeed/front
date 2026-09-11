import type { OpenGraphPreview } from '../../../shared/previewContracts';
import type { FeedItemPreview } from './feedItemPreviewTypes';
import { getVkVideoPreview } from './vkPreview';
import { isDirectVideoValue, isRedditVideoUrl, parseUrl } from './feedItemUrls';

export function getRemoteFeedItemPreview(
  preview: OpenGraphPreview | null,
  title: string,
): FeedItemPreview | null {
  if (!preview) return null;
  const altTitle = preview.title || title;

  if (preview.video) {
    const videoUrl = parseUrl(preview.video);
    const vkVideoPreview = videoUrl ? getVkVideoPreview(videoUrl, altTitle) : null;
    if (videoUrl && vkVideoPreview) {
      return {
        src: `/bff/vk-video?url=${encodeURIComponent(videoUrl.href)}`,
        alt: { kind: 'vk', title: altTitle || null },
        type: 'video',
        ...(preview.image ? { poster: preview.image } : {}),
      };
    }
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
