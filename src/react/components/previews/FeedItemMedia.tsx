import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { useSoundGesture } from '../../hooks/useSoundGesture';
import { TikTokEmbed } from './TikTokEmbed';
import { VideoEmbed } from './VideoEmbed';
import { HltvImageScore } from './HltvMatch';
import { SpotifyPlaylistPreview } from './SpotifyPlaylistPreview';
import { getSpotifyEmbed } from '../../domain/spotifyPreview';
import { InstagramEmbed } from './InstagramEmbed';

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

type ImagePreview = Omit<LocalizedFeedItemPreview, 'type'> & { type?: undefined };

type ImageMetrics = {
  src: string;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
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
  const { t } = useTranslation();
  const requiresSoundGesture = isAppleMobileDevice();
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [imageMetrics, setImageMetrics] = useState<ImageMetrics | null>(null);
  const [displayedImage, setDisplayedImage] = useState<ImagePreview | null>(
    preview.type === undefined ? preview as ImagePreview : null,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundGesture = useSoundGesture(requiresSoundGesture, preview.src);

  useEffect(() => {
    setVideoAspectRatio(null);
  }, [preview.src]);

  if (preview.type === 'video') {
    return (
      <div className={[
        'reader-card__preview',
        'reader-card__preview--video',
        videoAspectRatio ? 'reader-card__preview--video-adaptive' : '',
        isShortVideo ? 'reader-card__preview--short-video' : '',
        isTikTok ? 'reader-card__preview--tiktok' : '',
      ].filter(Boolean).join(' ')}
        style={videoAspectRatio ? {
          '--reader-video-aspect-ratio': videoAspectRatio,
          aspectRatio: videoAspectRatio,
        } as CSSProperties : undefined}
      >
        <video
          ref={videoRef}
          src={preview.src}
          poster={preview.poster}
          aria-label={preview.alt}
          autoPlay
          controls
          loop
          muted={soundGesture.isMuted}
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            const { videoHeight, videoWidth } = event.currentTarget;
            if (videoHeight > 0 && videoWidth > 0) {
              setVideoAspectRatio(videoWidth / videoHeight);
            }
          }}
          onError={onPreviewError}
        />
        {soundGesture.showPrompt ? (
          <button
            type="button"
            className="reader-card__sound-toggle"
            onClick={() => {
              soundGesture.enableSound();
              if (videoRef.current) {
                videoRef.current.muted = false;
                void videoRef.current.play();
              }
            }}
          >
            {t('preview.sound')}
          </button>
        ) : null}
        {overlay}
      </div>
    );
  }

  if (preview.type === 'embed') {
    const embed = isTikTok ? (
      <TikTokEmbed
        src={preview.src}
        title={preview.alt}
        soundGesture={soundGesture}
      />
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

  const imagePreview = preview as ImagePreview;
  const waitsForRemoteImage = Boolean(
    imagePreview.fallbackSrc
      && displayedImage?.src === imagePreview.fallbackSrc
      && displayedImage.src !== imagePreview.src,
  );
  const visibleImage = waitsForRemoteImage && displayedImage
    ? displayedImage
    : imagePreview;
  const visibleImageMetrics = imageMetrics?.src === visibleImage.src ? imageMetrics : null;

  const spotifyEmbed = getSpotifyEmbed(href);
  if (spotifyEmbed) {
    return (
      <SpotifyPlaylistPreview
        embedUrl={spotifyEmbed.url}
        embedHeight={spotifyEmbed.height}
        spotifyUrl={href}
        imageSrc={preview.src}
        imageAlt={preview.alt}
        title={hostname}
        onPreviewError={onPreviewError}
      />
    );
  }

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
          src={imagePreview.src}
          alt=""
          aria-hidden="true"
          hidden
          data-preview-preloader=""
          style={{ display: 'none' }}
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            const metrics = readImageMetrics(event.currentTarget, imagePreview.src);
            if (metrics) setImageMetrics(metrics);
            setDisplayedImage(imagePreview);
          }}
          onError={onPreviewError}
        />
      ) : null}
      {hltvImageScore ? <HltvImageScore score={hltvImageScore} /> : null}
      {overlay}
    </a>
  );
}
