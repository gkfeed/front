import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { readSasflixProgress, writeSasflixProgress } from '../../services/sasflixProgress';
import { TheaterPlayerShell } from './TheaterPlayerShell';
import { useHlsVideo } from './useHlsVideo';
import { useTheaterDialog } from './useTheaterDialog';

type SasflixPreviewProps = {
  href: string;
  publicationId: string;
  title: string;
  videoSrc: string | null;
  previewStatus: 'idle' | 'pending' | 'loaded' | 'failed';
  preview: LocalizedFeedItemPreview | null;
  onPreviewError: () => void;
};

export function SasflixPreview({
  href,
  publicationId,
  title,
  videoSrc,
  previewStatus,
  preview,
  onPreviewError,
}: SasflixPreviewProps) {
  const { t } = useTranslation();
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const previousVideoSrcRef = useRef(videoSrc);
  const pendingTheaterRef = useRef(false);

  useEffect(() => {
    if (previousVideoSrcRef.current && previousVideoSrcRef.current !== videoSrc) {
      setIsPlayerOpen(false);
      setIsTheaterOpen(false);
      pendingTheaterRef.current = false;
    }
    previousVideoSrcRef.current = videoSrc;
  }, [videoSrc]);

  // If the user clicked play before the HLS source resolved, open theater
  // once the video becomes available.
  useEffect(() => {
    if (pendingTheaterRef.current && videoSrc && isPlayerOpen) {
      pendingTheaterRef.current = false;
      setIsTheaterOpen(true);
    }
  }, [videoSrc, isPlayerOpen]);

  useTheaterDialog({
    initialFocusSelector: 'video',
    isOpen: isTheaterOpen && Boolean(videoSrc) && isPlayerOpen,
    onOpenChange: (isOpen) => {
      if (!isOpen) pendingTheaterRef.current = false;
      setIsTheaterOpen(isOpen);
    },
    playerRef,
    triggerRef,
  });

  if (isPlayerOpen && videoSrc) {
    return (
      <SasflixPlayer
        publicationId={publicationId}
        title={title}
        videoSrc={videoSrc}
        isTheaterOpen={isTheaterOpen}
        shellRef={playerRef}
        onToggleTheater={() => {
          pendingTheaterRef.current = false;
          setIsTheaterOpen((isOpen) => !isOpen);
        }}
      />
    );
  }

  return (
    <div className="reader-card__preview-trigger-wrap">
      {videoSrc || previewStatus !== 'failed' ? (
        <button
          type="button"
          ref={triggerRef}
          className="reader-card__preview-trigger"
          aria-label={t('preview.playSasflix', { title })}
          onClick={() => {
            setIsPlayerOpen(true);
            if (videoSrc) {
              setIsTheaterOpen(true);
            } else {
              pendingTheaterRef.current = true;
            }
          }}
        />
      ) : (
        <a
          className="reader-card__preview-trigger"
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={t('preview.open', { hostname: 'sasflix.ru' })}
        />
      )}
      {preview ? (
        <div className="reader-card__preview">
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            onError={onPreviewError}
          />
        </div>
      ) : null}
    </div>
  );
}

type SasflixPlayerProps = {
  publicationId: string;
  title: string;
  videoSrc: string;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function SasflixPlayer({
  publicationId,
  title,
  videoSrc,
  isTheaterOpen,
  onToggleTheater,
  shellRef,
}: SasflixPlayerProps) {
  const { t } = useTranslation();
  const [isDoubleSpeed, setIsDoubleSpeed] = useState(true);
  const [resumePosition] = useState(() => readSasflixProgress(publicationId)?.position ?? null);
  const [isResumeAvailable, setIsResumeAvailable] = useState(resumePosition !== null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canPersistRef = useRef(resumePosition === null);
  const currentTimeRef = useRef<number | null>(resumePosition);
  const durationRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);
  const playerTitle = t('preview.sasflixPlayer', { title });
  useHlsVideo({ src: videoSrc, videoRef });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.defaultPlaybackRate = 2;
    video.playbackRate = 2;
    setIsDoubleSpeed(true);
  }, [videoSrc]);

  const sampleProgress = useCallback((video = videoRef.current) => {
    if (!video || !Number.isFinite(video.currentTime) || !Number.isFinite(video.duration) || video.duration <= 0) {
      return false;
    }
    currentTimeRef.current = video.currentTime;
    durationRef.current = video.duration;
    return true;
  }, []);

  const persistProgress = useCallback((force = false) => {
    if (!canPersistRef.current) return;
    sampleProgress();
    const position = currentTimeRef.current;
    const duration = durationRef.current;
    if (position === null || duration === null) return;
    const now = Date.now();
    if (!force && now - lastPersistedAtRef.current < 4000) return;
    writeSasflixProgress(publicationId, position, duration);
    lastPersistedAtRef.current = now;
  }, [publicationId, sampleProgress]);

  useEffect(() => {
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistProgress(true);
    };
    const persistOnPageHide = () => persistProgress(true);
    const progressTimer = window.setInterval(() => persistProgress(), 5000);
    window.addEventListener('pagehide', persistOnPageHide);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      window.clearInterval(progressTimer);
      window.removeEventListener('pagehide', persistOnPageHide);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      persistProgress(true);
    };
  }, [persistProgress]);

  return (
    <TheaterPlayerShell
      title={playerTitle}
      isTheaterOpen={isTheaterOpen}
      onToggleTheater={onToggleTheater}
      shellRef={shellRef}
      toolbar={(
        <>
          {isResumeAvailable && resumePosition !== null ? (
            <button
              type="button"
              className="reader-card__resume-toggle"
              aria-label={t('preview.continueVideo', { position: formatVideoTime(resumePosition) })}
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                canPersistRef.current = true;
                video.currentTime = resumePosition;
                setIsResumeAvailable(false);
                void video.play().catch(() => undefined);
              }}
            >
              {t('preview.continueVideo', { position: formatVideoTime(resumePosition) })}
            </button>
          ) : null}
          <button
            type="button"
            className="reader-card__speed-toggle"
            aria-label={t('preview.playbackSpeed', { speed: isDoubleSpeed ? '2x' : '1x' })}
            aria-pressed={isDoubleSpeed}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              const nextRate = video.playbackRate === 2 ? 1 : 2;
              video.defaultPlaybackRate = nextRate;
              video.playbackRate = nextRate;
              setIsDoubleSpeed(nextRate === 2);
            }}
          >
            {isDoubleSpeed ? '2x' : '1x'}
          </button>
        </>
      )}
    >
      <video
        ref={videoRef}
        title={playerTitle}
        controls
        autoPlay={resumePosition === null}
        playsInline
        onDurationChange={(event) => sampleProgress(event.currentTarget)}
        onEnded={() => persistProgress(true)}
        onPause={() => persistProgress(true)}
        onPlay={() => {
          canPersistRef.current = true;
          setIsResumeAvailable(false);
        }}
        onRateChange={(event) => setIsDoubleSpeed(event.currentTarget.playbackRate === 2)}
        onTimeUpdate={(event) => {
          sampleProgress(event.currentTarget);
          persistProgress();
        }}
      />
    </TheaterPlayerShell>
  );
}

function formatVideoTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
