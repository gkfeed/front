import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { useSoundGesture } from '../../hooks/useSoundGesture';

type VideoPreview = LocalizedFeedItemPreview & { type: 'video' };

export function FeedItemVideoMedia({
  preview,
  isShortVideo,
  isTikTok,
  onPreviewError,
  overlay,
}: {
  preview: VideoPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  onPreviewError: () => void;
  overlay?: ReactNode;
}) {
  const { t } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundGesture = useSoundGesture(isAppleMobileDevice(), preview.src);

  useEffect(() => {
    setAspectRatio(null);
  }, [preview.src]);

  return (
    <div
      className={[
        'reader-card__preview',
        'reader-card__preview--video',
        aspectRatio ? 'reader-card__preview--video-adaptive' : '',
        isShortVideo ? 'reader-card__preview--short-video' : '',
        isTikTok ? 'reader-card__preview--tiktok' : '',
      ].filter(Boolean).join(' ')}
      style={aspectRatio ? {
        '--reader-video-aspect-ratio': aspectRatio,
        aspectRatio,
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
          if (videoHeight > 0 && videoWidth > 0) setAspectRatio(videoWidth / videoHeight);
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
