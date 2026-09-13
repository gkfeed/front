import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { isTempfileUrl, parseUrl } from '../../domain/feedItemUrls';
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
  const [tempfileFailed, setTempfileFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAutoAppliedDoubleSpeed = useRef(false);
  const localSoundGesture = useSoundGesture(isAppleMobileDevice(), preview.src);
  const soundGesture = sharedSoundGesture ?? localSoundGesture;

  useEffect(() => {
    setAspectRatio(null);
    setDuration(null);
    setPlaybackRate(1);
    setTempfileFailed(false);
    hasAutoAppliedDoubleSpeed.current = false;
    if (videoRef.current) videoRef.current.playbackRate = 1;
  }, [preview.src]);

  useEffect(() => {
    if (!isTikTok || duration !== null) return;
    const timeout = window.setTimeout(onPreviewError, 15_000);
    return () => window.clearTimeout(timeout);
  }, [isTikTok, duration, onPreviewError]);

  const updateDuration = (video: HTMLVideoElement) => {
    const nextDuration = video.duration;
    const isLongTikTok = isTikTok && Number.isFinite(nextDuration) && nextDuration > 60;
    setDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : null);
    if (!isTikTok) return;

    if (!isLongTikTok) {
      hasAutoAppliedDoubleSpeed.current = false;
      setPlaybackRate(1);
      if (video.playbackRate !== 1) video.playbackRate = 1;
      return;
    }

    if (!hasAutoAppliedDoubleSpeed.current) {
      hasAutoAppliedDoubleSpeed.current = true;
      setPlaybackRate(2);
      if (video.playbackRate !== 2) video.playbackRate = 2;
    }
  };

  const handlePreviewError = () => {
    if (isTempfileUrl(parseUrl(preview.src))) {
      setTempfileFailed(true);
      return;
    }
    onPreviewError();
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
      {tempfileFailed ? (
        <div className="reader-card__media-error" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3 2.8 19h18.4L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M12 8v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="1" fill="currentColor" />
          </svg>
          <strong>{t('preview.tempfileUnavailable')}</strong>
          <span>{t('preview.tempfileError')}</span>
          <a href={preview.src} target="_blank" rel="noreferrer">
            {t('preview.openTemporaryLink')}
          </a>
        </div>
      ) : (
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
          onError={handlePreviewError}
        />
      )}
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
      {!tempfileFailed && soundGesture.showPrompt ? (
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
