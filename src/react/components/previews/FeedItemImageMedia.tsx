import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { HltvImageScore } from './HltvMatch';

export type ImagePreview = Omit<LocalizedFeedItemPreview, 'type'> & { type?: undefined };

type ImageMetrics = {
  src: string;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
};

const roundedImageMask = [
  'linear-gradient(#000 0 0) center / 100% calc(100% - 44px) no-repeat',
  'linear-gradient(#000 0 0) center / calc(100% - 44px) 100% no-repeat',
  'radial-gradient(circle at 22px 22px, #000 21.5px, transparent 22px) top left / 50% 50% no-repeat',
  'radial-gradient(circle at calc(100% - 22px) 22px, #000 21.5px, transparent 22px) top right / 50% 50% no-repeat',
  'radial-gradient(circle at 22px calc(100% - 22px), #000 21.5px, transparent 22px) bottom left / 50% 50% no-repeat',
  'radial-gradient(circle at calc(100% - 22px) calc(100% - 22px), #000 21.5px, transparent 22px) bottom right / 50% 50% no-repeat',
].join(', ');

const roundedImageStyle: CSSProperties = {
  overflow: 'hidden',
  borderRadius: 22,
  clipPath: 'inset(0 round 22px)',
  WebkitMask: roundedImageMask,
  mask: roundedImageMask,
  contain: 'paint',
};

function readImageMetrics(image: HTMLImageElement, src: string): ImageMetrics | null {
  const { naturalHeight, naturalWidth } = image;
  if (naturalHeight <= 0 || naturalWidth <= 0) return null;

  return {
    src,
    aspectRatio: naturalWidth / naturalHeight,
    orientation: naturalWidth === naturalHeight
      ? 'square'
      : naturalWidth > naturalHeight ? 'landscape' : 'portrait',
  };
}

export function FeedItemImageMedia({
  href,
  hostname,
  preview,
  isShortVideo,
  isTikTok,
  hltvImageScore,
  onPreviewError,
  overlay,
  useRoundedImageSurface,
}: {
  href: string;
  hostname: string;
  preview: ImagePreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  hltvImageScore: [string, string] | null;
  onPreviewError: () => void;
  overlay?: ReactNode;
  useRoundedImageSurface: boolean;
}) {
  const { t } = useTranslation();
  const [imageMetrics, setImageMetrics] = useState<ImageMetrics | null>(null);
  const [displayedImage, setDisplayedImage] = useState<ImagePreview>(preview);
  const waitsForRemoteImage = Boolean(
    preview.fallbackSrc
      && displayedImage.src === preview.fallbackSrc
      && displayedImage.src !== preview.src,
  );
  const visibleImage = waitsForRemoteImage ? displayedImage : preview;
  const visibleImageMetrics = imageMetrics?.src === visibleImage.src ? imageMetrics : null;

  const visibleImageElement = (
    <img
      src={visibleImage.src}
      alt={visibleImage.alt}
      style={roundedImageStyle}
      referrerPolicy="no-referrer"
      onLoad={(event) => {
        const metrics = readImageMetrics(event.currentTarget, visibleImage.src);
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
      data-media-orientation={visibleImageMetrics?.orientation}
      style={{
        ...roundedImageStyle,
        ...(visibleImageMetrics ? {
          '--reader-media-aspect-ratio': visibleImageMetrics.aspectRatio,
        } as CSSProperties : {}),
      }}
    >
      {useRoundedImageSurface ? (
        <span className="reader-card__image-surface" style={roundedImageStyle}>
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
            const metrics = readImageMetrics(event.currentTarget, preview.src);
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
