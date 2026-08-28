import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';

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

  useEffect(() => {
    if (!isTheaterOpen) return;
    if (!videoSrc) return;
    if (!isPlayerOpen) return;
    document.documentElement.classList.add('reader-theater-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        pendingTheaterRef.current = false;
        setIsTheaterOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(playerRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const playerElement = playerRef.current;
    const triggerElement = triggerRef.current;
    window.addEventListener('keydown', handleKeyDown);
    // Player may not be mounted yet when theater is requested before videoSrc.
    // Defer focus so the video element exists.
    const focusTimer = window.setTimeout(() => {
      playerRef.current?.querySelector<HTMLVideoElement>('video')?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
      if (playerElement?.contains(document.activeElement)) {
        playerElement.querySelector<HTMLButtonElement>('button')?.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [isTheaterOpen, videoSrc, isPlayerOpen]);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let destroyPlayer: (() => void) | undefined;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoSrc;
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (!active || !Hls.isSupported()) return;
        const hls = new Hls();
        destroyPlayer = () => hls.destroy();
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
      });
    }

    return () => {
      active = false;
      destroyPlayer?.();
      video.removeAttribute('src');
    };
  }, [videoSrc]);

  return (
    <div
      ref={shellRef}
      className={[
        'reader-card__player-shell',
        isTheaterOpen ? 'reader-card__player-shell--theater' : '',
      ].filter(Boolean).join(' ')}
      role={isTheaterOpen ? 'dialog' : undefined}
      aria-modal={isTheaterOpen ? 'true' : undefined}
      aria-label={isTheaterOpen ? playerTitle : undefined}
    >
      <div className="reader-card__player-stage">
        <div className="reader-card__player-toolbar">
          <button
            type="button"
            className="reader-card__theater-toggle"
            aria-label={isTheaterOpen ? t('preview.exitTheater') : t('preview.enterTheater')}
            aria-pressed={isTheaterOpen}
            onClick={onToggleTheater}
          >
            <span aria-hidden="true">{isTheaterOpen ? '↙' : '↗'}</span>
            {isTheaterOpen ? t('preview.exitTheaterShort') : t('preview.theater')}
          </button>
        </div>
        <div className="reader-card__preview reader-card__preview--player">
          <video
            ref={videoRef}
            title={playerTitle}
            controls
            autoPlay
            playsInline
          />
        </div>
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, video, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
