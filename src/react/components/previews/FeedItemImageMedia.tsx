import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { HltvImageScore } from './HltvMatch';
import {
  createImagePresentationFacts,
  imageClippingStyle,
  readImagePresentationMetrics,
  type ImagePresentationMetrics,
  type ImagePresentationProfile,
} from './feedItemImagePresentation';

export type ImagePreview = Omit<LocalizedFeedItemPreview, 'type'> & { type?: undefined };

export function FeedItemImageMedia({
  href,
  hostname,
  preview,
  isShortVideo,
  isTikTok,
  hltvImageScore,
  onPreviewError,
  overlay,
  presentationProfile,
}: {
  href: string;
  hostname: string;
  preview: ImagePreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  hltvImageScore: [string, string] | null;
  onPreviewError: () => void;
  overlay?: ReactNode;
  presentationProfile: ImagePresentationProfile;
}) {
  const { t } = useTranslation();
  const [imageMetrics, setImageMetrics] = useState<ImagePresentationMetrics | null>(null);
  const [displayedImage, setDisplayedImage] = useState<ImagePreview>(preview);
  const waitsForRemoteImage = Boolean(
    preview.fallbackSrc
      && displayedImage.src === preview.fallbackSrc
      && displayedImage.src !== preview.src,
  );
  const visibleImage = waitsForRemoteImage ? displayedImage : preview;
  const visibleImageMetrics = imageMetrics?.src === visibleImage.src ? imageMetrics : null;
  const presentation = createImagePresentationFacts(presentationProfile, visibleImageMetrics);

  const visibleImageElement = (
    <img
      src={visibleImage.src}
      alt={visibleImage.alt}
      style={imageClippingStyle}
      referrerPolicy="no-referrer"
      onLoad={(event) => {
        const metrics = readImagePresentationMetrics(event.currentTarget, visibleImage.src);
        if (metrics) setImageMetrics(metrics);
      }}
      onError={onPreviewError}
    />
  );

  return (
    <a
      className={[
        'reader-card__preview',
        'reader-card__preview--image',
        isShortVideo ? 'reader-card__preview--short-video' : '',
        isTikTok ? 'reader-card__preview--tiktok' : '',
      ].filter(Boolean).join(' ')}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={hltvImageScore
        ? t('preview.openScore', { hostname, first: hltvImageScore[0], second: hltvImageScore[1] })
        : t('preview.open', { hostname })}
      data-media-orientation={presentation.orientation}
      data-vk-feed-placeholder={presentation.isPlaceholder ? '' : undefined}
      data-image-presentation={presentationProfile}
      style={presentation.style}
    >
      {presentation.usesImageSurface ? (
        <span className="reader-card__image-surface" style={imageClippingStyle}>
          {visibleImageElement}
        </span>
      ) : visibleImageElement}
      {waitsForRemoteImage ? (
        <img
          src={preview.src}
          alt=""
          aria-hidden="true"
          hidden
          data-preview-preloader=""
          style={{ display: 'none' }}
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            const metrics = readImagePresentationMetrics(event.currentTarget, preview.src);
            if (metrics) setImageMetrics(metrics);
            setDisplayedImage(preview);
          }}
          onError={onPreviewError}
        />
      ) : null}
      {hltvImageScore ? <HltvImageScore score={hltvImageScore} /> : null}
      {overlay}
    </a>
  );
}
