import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { readYoutubeProgress, writeYoutubeProgress } from '../../services/youtubeProgress';

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
  const [resumeProgress, setResumeProgress] = useState(() => readYoutubeProgress(videoId));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
    setIsDoubleSpeed(true);
    setResumeProgress(readYoutubeProgress(videoId));
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
        resumePosition={resumeProgress?.position ?? null}
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
      <div className="reader-card__preview-trigger-wrap">
        <button
          type="button"
          ref={triggerRef}
          className="reader-card__preview-trigger"
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
      </div>
    </>
  );
}

type YoutubePlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  isDoubleSpeed: boolean;
  resumePosition: number | null;
  onToggleTheater: () => void;
  onTogglePlaybackSpeed: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function YoutubePlayer({
  videoId,
  title,
  isTheaterOpen,
  isDoubleSpeed,
  resumePosition,
  onToggleTheater,
  onTogglePlaybackSpeed,
  shellRef,
}: YoutubePlayerProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1' });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeId = useId().replaceAll(':', '');
  const [isResumeAvailable, setIsResumeAvailable] = useState(resumePosition !== null);
  const [isResumeRequested, setIsResumeRequested] = useState(false);

  useEffect(() => {
    setIsResumeAvailable(resumePosition !== null);
    setIsResumeRequested(false);
  }, [resumePosition]);

  useEffect(() => {
    const sendCurrentPlaybackRate = () => sendPlaybackRate(iframeRef.current, isDoubleSpeed ? 2 : 1);
    const retryTimers = [300, 1000].map((delay) => window.setTimeout(sendCurrentPlaybackRate, delay));
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [isDoubleSpeed]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const latestProgressRef = {
      current: { position: undefined as number | undefined, duration: undefined as number | undefined },
    };
    let lastPersistedAt = 0;

    const persistProgress = (force = false) => {
      const latestProgress = latestProgressRef.current;
      if (latestProgress.position === undefined || latestProgress.duration === undefined) return;
      const now = Date.now();
      if (!force && now - lastPersistedAt < 4000) return;
      writeYoutubeProgress(videoId, latestProgress.position, latestProgress.duration);
      lastPersistedAt = now;
    };

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframe.contentWindow || !isYoutubeMessageOrigin(event.origin)) return;
      const message = parseYoutubeMessage(event.data);
      if (!message) return;

      if (message.event === 'infoDelivery') {
        if (message.currentTime !== undefined) latestProgressRef.current.position = message.currentTime;
        if (message.duration !== undefined) latestProgressRef.current.duration = message.duration;
      }

      if ((message.event === 'onStateChange' || message.event === 'infoDelivery')
        && (message.state === 0 || message.state === 2)) {
        persistProgress(true);
      }
    };

    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistProgress(true);
    };
    const persistOnPageHide = () => persistProgress(true);
    const progressTimer = window.setInterval(() => persistProgress(), 5000);

    window.addEventListener('message', handleMessage);
    window.addEventListener('pagehide', persistOnPageHide);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      window.clearInterval(progressTimer);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('pagehide', persistOnPageHide);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      persistProgress(true);
    };
  }, [videoId]);

  useEffect(() => {
    if (!isResumeRequested || resumePosition === null) return;
    sendPlayerCommand(iframeRef.current, 'seekTo', [resumePosition, true]);
    sendPlayerCommand(iframeRef.current, 'playVideo');
  }, [isResumeRequested, resumePosition]);

  return (
    <div
      ref={shellRef}
      className={[
        'reader-card__player-shell',
        isTheaterOpen ? 'reader-card__player-shell--theater' : '',
      ].filter(Boolean).join(' ')}
      role={isTheaterOpen ? 'dialog' : undefined}
      aria-modal={isTheaterOpen ? 'true' : undefined}
      aria-label={isTheaterOpen ? (title || t('preview.youtubePlayer')) : undefined}
    >
      <div className="reader-card__player-stage">
        <div className="reader-card__player-toolbar">
          {isResumeAvailable && resumePosition !== null ? (
            <button
              type="button"
              className="reader-card__resume-toggle"
              aria-label={t('preview.continueVideo', { position: formatYoutubeTime(resumePosition) })}
              onClick={() => {
                setIsResumeAvailable(false);
                setIsResumeRequested(true);
              }}
            >
              {t('preview.continueVideo', { position: formatYoutubeTime(resumePosition) })}
            </button>
          ) : null}
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
        <div className="reader-card__preview reader-card__preview--player">
          <iframe
            id={iframeId}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || t('preview.youtubePlayer')}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            ref={iframeRef}
            onLoad={() => {
              initializeYoutubePlayer(iframeRef.current, iframeId);
              sendPlaybackRate(iframeRef.current, isDoubleSpeed ? 2 : 1);
              if (isResumeRequested && resumePosition !== null) {
                sendPlayerCommand(iframeRef.current, 'seekTo', [resumePosition, true]);
                sendPlayerCommand(iframeRef.current, 'playVideo');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function sendPlaybackRate(iframe: HTMLIFrameElement | null, playbackRate: number): void {
  sendPlayerCommand(iframe, 'setPlaybackRate', [playbackRate]);
}

function sendPlayerCommand(
  iframe: HTMLIFrameElement | null,
  func: 'playVideo' | 'pauseVideo' | 'setPlaybackRate' | 'seekTo',
  args: unknown[] = [],
): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({
    event: 'command',
    func,
    args,
  }), '*');
}

function initializeYoutubePlayer(iframe: HTMLIFrameElement | null, iframeId: string): void {
  const target = iframe?.contentWindow;
  if (!target) return;

  target.postMessage(JSON.stringify({
    event: 'listening',
    id: iframeId,
    channel: 'gkfeed',
    version: 3,
  }), '*');
  target.postMessage(JSON.stringify({
    event: 'command',
    func: 'addEventListener',
    args: ['onStateChange'],
    id: iframeId,
    channel: 'gkfeed',
  }), '*');
}

function parseYoutubeMessage(value: unknown): {
  event: string;
  currentTime?: number;
  duration?: number;
  state?: number;
} | null {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  if (!parsed || typeof parsed !== 'object') return null;
  const message = parsed as Record<string, unknown>;
  if (typeof message.event !== 'string') return null;

  const info = message.info && typeof message.info === 'object'
    ? message.info as Record<string, unknown>
    : null;
  const currentTime = getFiniteNumber(info?.currentTime);
  const duration = getFiniteNumber(info?.duration);
  const state = getFiniteNumber(message.state)
    ?? getFiniteNumber(message.info)
    ?? getFiniteNumber(info?.playerState);

  return {
    event: message.event,
    currentTime,
    duration,
    state,
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isYoutubeMessageOrigin(origin: string): boolean {
  return origin === 'https://www.youtube-nocookie.com' || origin === 'https://www.youtube.com';
}

function formatYoutubeTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, iframe, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
