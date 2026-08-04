import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';

type MatreshkaPreviewProps = {
  videoId: string;
  title: string;
  preview: LocalizedFeedItemPreview | null;
  onPreviewError: () => void;
};

export function MatreshkaPreview({
  videoId,
  title,
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
    playerElement?.querySelector<HTMLIFrameElement>('iframe')?.focus();
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
          <iframe
            src={`https://matreshka.tv/embed/video/${encodeURIComponent(videoId)}`}
            title={playerTitle}
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, iframe, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
