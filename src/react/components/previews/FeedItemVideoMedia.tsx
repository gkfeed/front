import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { type SoundGestureLifecycle, useSoundGesture } from '../../hooks/useSoundGesture';

type VideoPreview = LocalizedFeedItemPreview & { type: 'video' };

export function FeedItemVideoMedia({
  preview,
  isShortVideo,
  isTikTok,
  onPreviewError,
  overlay,
  soundGesture: sharedSoundGesture,
}: {
  preview: VideoPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  onPreviewError: () => void;
  overlay?: ReactNode;
  soundGesture?: SoundGestureLifecycle;
}) {
  const { t } = useTranslation();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localSoundGesture = useSoundGesture(isAppleMobileDevice(), preview.src);
  const soundGesture = sharedSoundGesture ?? localSoundGesture;

  useEffect(() => {
    setAspectRatio(null);
    setDuration(null);
    setPlaybackRate(1);
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, [preview.src]);

  useEffect(() => {
    if (!isTikTok || duration !== null) return;
    const timeout = window.setTimeout(onPreviewError, 15_000);
    return () => window.clearTimeout(timeout);
  }, [isTikTok, duration, onPreviewError]);

  const updateDuration = (video: HTMLVideoElement) => {
    const nextDuration = video.duration;
    setDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : null);
    if (isTikTok && !(Number.isFinite(nextDuration) && nextDuration > 60)) video.playbackRate = 1;
  };

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
        key={preview.src}
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
          updateDuration(event.currentTarget);
          const { videoHeight, videoWidth } = event.currentTarget;
          if (videoHeight > 0 && videoWidth > 0) setAspectRatio(videoWidth / videoHeight);
        }}
        onDurationChange={(event) => updateDuration(event.currentTarget)}
        onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
        onError={onPreviewError}
      />
      {isTikTok && duration !== null && duration > 60 ? (
        <button
          type="button"
          className="reader-card__speed-toggle"
          aria-label={t('preview.doubleSpeed')}
          aria-pressed={playbackRate === 2}
          onClick={() => {
            const video = videoRef.current;
            if (video) video.playbackRate = video.playbackRate === 2 ? 1 : 2;
          }}
        >
          2×
        </button>
      ) : null}
      {soundGesture.showPrompt ? (
        <button
          type="button"
          className="reader-card__sound-toggle"
          onClick={() => {
            soundGesture.enableSound();
            if (videoRef.current) {
              videoRef.current.muted = false;
              void videoRef.current.play().catch(() => undefined);
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
