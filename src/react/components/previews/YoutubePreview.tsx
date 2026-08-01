import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';

type YoutubePreviewProps = {
  onPreviewError: () => void;
  preview: LocalizedFeedItemPreview | null;
  title: string;
  videoId: string;
};

export function YoutubePreview({
  onPreviewError,
  preview,
  title,
  videoId,
}: YoutubePreviewProps) {
  const { t } = useTranslation();
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const [isDoubleSpeed, setIsDoubleSpeed] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
    setIsDoubleSpeed(true);
  }, [videoId]);

  useEffect(() => {
    if (!isTheaterOpen) return;
    document.documentElement.classList.add('reader-theater-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
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
    playerElement?.querySelector<HTMLElement>('button, iframe')?.focus();
    return () => {
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
      if (playerElement?.contains(document.activeElement)) {
        playerElement.querySelector<HTMLButtonElement>('button')?.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [isTheaterOpen]);

  if (isPlayerOpen) {
    return (
      <YoutubePlayer
        videoId={videoId}
        title={title}
        isTheaterOpen={isTheaterOpen}
        isDoubleSpeed={isDoubleSpeed}
        shellRef={playerRef}
        onToggleTheater={() => setIsTheaterOpen((isOpen) => !isOpen)}
        onTogglePlaybackSpeed={() => {
          const nextIsDoubleSpeed = !isDoubleSpeed;
          setIsDoubleSpeed(nextIsDoubleSpeed);
          sendPlaybackRate(
            playerRef.current?.querySelector<HTMLIFrameElement>('iframe') ?? null,
            nextIsDoubleSpeed ? 2 : 1,
          );
        }}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="reader-card__youtube-trigger"
        aria-label={t('preview.playVideo', { title })}
        onClick={() => {
          setIsPlayerOpen(true);
          setIsTheaterOpen(true);
        }}
      />
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
    </>
  );
}

type YoutubePlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  isDoubleSpeed: boolean;
  onToggleTheater: () => void;
  onTogglePlaybackSpeed: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function YoutubePlayer({
  videoId,
  title,
  isTheaterOpen,
  isDoubleSpeed,
  onToggleTheater,
  onTogglePlaybackSpeed,
  shellRef,
}: YoutubePlayerProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1' });
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const sendCurrentPlaybackRate = () => sendPlaybackRate(iframeRef.current, isDoubleSpeed ? 2 : 1);
    const retryTimers = [300, 1000].map((delay) => window.setTimeout(sendCurrentPlaybackRate, delay));
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [isDoubleSpeed]);

  return (
    <div
      ref={shellRef}
      className={[
        'reader-card__youtube-player-shell',
        isTheaterOpen ? 'reader-card__youtube-player-shell--theater' : '',
      ].filter(Boolean).join(' ')}
      role={isTheaterOpen ? 'dialog' : undefined}
      aria-modal={isTheaterOpen ? 'true' : undefined}
      aria-label={isTheaterOpen ? (title || t('preview.youtubePlayer')) : undefined}
    >
      <div className="reader-card__youtube-player-stage">
        <div className="reader-card__youtube-player-toolbar">
          <button
            type="button"
            className="reader-card__speed-toggle"
            aria-label={t('preview.playbackSpeed', { speed: isDoubleSpeed ? '2x' : '1x' })}
            aria-pressed={isDoubleSpeed}
            onClick={onTogglePlaybackSpeed}
          >
            {isDoubleSpeed ? '2x' : '1x'}
          </button>
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
        <div className="reader-card__preview reader-card__preview--youtube-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || t('preview.youtubePlayer')}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            ref={iframeRef}
            onLoad={() => sendPlaybackRate(iframeRef.current, isDoubleSpeed ? 2 : 1)}
          />
        </div>
      </div>
    </div>
  );
}

function sendPlaybackRate(iframe: HTMLIFrameElement | null, playbackRate: number): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({
    event: 'command',
    func: 'setPlaybackRate',
    args: [playbackRate],
  }), '*');
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, iframe, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
