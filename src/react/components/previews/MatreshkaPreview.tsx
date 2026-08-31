import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { TheaterPlayerShell } from './TheaterPlayerShell';
import { useHlsVideo } from './useHlsVideo';
import { useTheaterDialog } from './useTheaterDialog';

const MATRESHKA_HLS_CONFIG = {
  startLevel: -1,
  capLevelToPlayerSize: true,
};

type MatreshkaPreviewProps = {
  videoId: string;
  title: string;
  videoSrc: string | null;
  preview: LocalizedFeedItemPreview | null;
  onPreviewError: () => void;
};

export function MatreshkaPreview({
  videoId,
  title,
  videoSrc,
  preview,
  onPreviewError,
}: MatreshkaPreviewProps) {
  const { t } = useTranslation();
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
  }, [videoId]);

  useTheaterDialog({
    isOpen: isTheaterOpen,
    onOpenChange: setIsTheaterOpen,
    playerRef,
    triggerRef,
  });

  if (isPlayerOpen) {
    return (
      <MatreshkaPlayer
        videoId={videoId}
        title={title}
        isTheaterOpen={isTheaterOpen}
        shellRef={playerRef}
        onToggleTheater={() => setIsTheaterOpen((isOpen) => !isOpen)}
      />
    );
  }

  return (
    <div className="reader-card__preview-trigger-wrap">
      <button
        type="button"
        ref={triggerRef}
        className="reader-card__preview-trigger"
        aria-label={t('preview.playMatreshka', { title })}
        onClick={() => {
          setIsPlayerOpen(true);
          setIsTheaterOpen(true);
        }}
      />
      {preview ? (
        <div className="reader-card__preview reader-card__preview--matreshka-frame">
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            onError={onPreviewError}
          />
          {videoSrc ? <MatreshkaStreamFrame src={videoSrc} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function MatreshkaStreamFrame({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setIsReady(false);
    setHasFailed(false);
  }, [src]);
  useHlsVideo({
    config: MATRESHKA_HLS_CONFIG,
    onFatalError: () => setHasFailed(true),
    src,
    videoRef,
  });

  if (hasFailed) return null;
  return (
    <video
      ref={videoRef}
      className={isReady ? 'reader-card__matreshka-frame--ready' : undefined}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onLoadedMetadata={(event) => {
        const { duration } = event.currentTarget;
        event.currentTarget.currentTime = Number.isFinite(duration)
          ? Math.min(2, Math.max(0, duration - 0.1))
          : 2;
      }}
      onSeeked={() => setIsReady(true)}
      onError={() => setHasFailed(true)}
    />
  );
}

type MatreshkaPlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function MatreshkaPlayer({
  videoId,
  title,
  isTheaterOpen,
  onToggleTheater,
  shellRef,
}: MatreshkaPlayerProps) {
  const { t } = useTranslation();
  const playerTitle = t('preview.matreshkaPlayer', { title });

  return (
    <TheaterPlayerShell
      title={playerTitle}
      isTheaterOpen={isTheaterOpen}
      onToggleTheater={onToggleTheater}
      shellRef={shellRef}
    >
      <iframe
        src={`https://matreshka.tv/embed/video/${encodeURIComponent(videoId)}`}
        title={playerTitle}
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </TheaterPlayerShell>
  );
}
