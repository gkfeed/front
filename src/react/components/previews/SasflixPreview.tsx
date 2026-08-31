import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { TheaterPlayerShell } from './TheaterPlayerShell';
import { useHlsVideo } from './useHlsVideo';
import { useTheaterDialog } from './useTheaterDialog';

type SasflixPreviewProps = {
  href: string;
  title: string;
  videoSrc: string | null;
  previewStatus: 'idle' | 'pending' | 'loaded' | 'failed';
  preview: LocalizedFeedItemPreview | null;
  onPreviewError: () => void;
};

export function SasflixPreview({
  href,
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
  title: string;
  videoSrc: string;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function SasflixPlayer({
  title,
  videoSrc,
  isTheaterOpen,
  onToggleTheater,
  shellRef,
}: SasflixPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerTitle = t('preview.sasflixPlayer', { title });
  useHlsVideo({ src: videoSrc, videoRef });

  return (
    <TheaterPlayerShell
      title={playerTitle}
      isTheaterOpen={isTheaterOpen}
      onToggleTheater={onToggleTheater}
      shellRef={shellRef}
    >
      <video
        ref={videoRef}
        title={playerTitle}
        controls
        autoPlay
        playsInline
      />
    </TheaterPlayerShell>
  );
}
