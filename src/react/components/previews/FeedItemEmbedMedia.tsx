import type { ReactNode } from 'react';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { useSoundGesture } from '../../hooks/useSoundGesture';
import { InstagramEmbed } from './InstagramEmbed';
import { TikTokEmbed } from './TikTokEmbed';
import { VideoEmbed } from './VideoEmbed';

type EmbedPreview = LocalizedFeedItemPreview & { type: 'embed' };

export function FeedItemEmbedMedia({
  preview,
  isShortVideo,
  isTikTok,
  overlay,
}: {
  preview: EmbedPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  overlay?: ReactNode;
}) {
  const soundGesture = useSoundGesture(isAppleMobileDevice(), preview.src);
  const embed = isTikTok ? (
    <TikTokEmbed src={preview.src} title={preview.alt} soundGesture={soundGesture} />
  ) : isShortVideo ? (
    <InstagramEmbed src={preview.src} title={preview.alt} />
  ) : (
    <VideoEmbed src={preview.src} title={preview.alt} />
  );

  return overlay ? (
    <div className="reader-card__media-stack">
      {embed}
      {overlay}
    </div>
  ) : embed;
}
