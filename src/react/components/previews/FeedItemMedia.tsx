import type { ReactNode } from 'react';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { FeedItemEmbedMedia } from './FeedItemEmbedMedia';
import { FeedItemImageMedia, type ImagePreview } from './FeedItemImageMedia';
import { FeedItemVideoMedia } from './FeedItemVideoMedia';

type FeedItemMediaProps = {
  href: string;
  hostname: string;
  preview: LocalizedFeedItemPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  hltvImageScore: [string, string] | null;
  onPreviewError: () => void;
  overlay?: ReactNode;
  useRoundedImageSurface?: boolean;
};

export function FeedItemMedia({
  href,
  hostname,
  preview,
  isShortVideo,
  isTikTok,
  hltvImageScore,
  onPreviewError,
  overlay,
  useRoundedImageSurface = false,
}: FeedItemMediaProps) {
  if (preview.type === 'video') {
    return (
      <FeedItemVideoMedia
        preview={preview as LocalizedFeedItemPreview & { type: 'video' }}
        isShortVideo={isShortVideo}
        isTikTok={isTikTok}
        onPreviewError={onPreviewError}
        overlay={overlay}
      />
    );
  }

  if (preview.type === 'embed') {
    return (
      <FeedItemEmbedMedia
        preview={preview as LocalizedFeedItemPreview & { type: 'embed' }}
        isShortVideo={isShortVideo}
        isTikTok={isTikTok}
        overlay={overlay}
      />
    );
  }

  return (
    <FeedItemImageMedia
      href={href}
      hostname={hostname}
      preview={preview as ImagePreview}
      isShortVideo={isShortVideo}
      isTikTok={isTikTok}
      hltvImageScore={hltvImageScore}
      onPreviewError={onPreviewError}
      overlay={overlay}
      useRoundedImageSurface={useRoundedImageSurface}
    />
  );
}
