import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import {
  loadYoutubeIframeApi,
  type YoutubePlayer,
  type YoutubePlayerStateChangeEvent,
} from '../../services/youtubeIframeApi';
import {
  readYoutubeProgress,
  writeYoutubeProgress,
} from '../../services/youtubeProgress';

type YoutubePreviewProps = {
  onPreviewError: () => void;
  preview: LocalizedFeedItemPreview | null;
  title: string;
  videoId: string;
};

const YOUTUBE_SEEK_STEP_SECONDS = 5;

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
  const [isPlaying, setIsPlaying] = useState(() => resumeProgress === null);
  const isPlayingRef = useRef(isPlaying);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
    setIsDoubleSpeed(true);
    const nextResumeProgress = readYoutubeProgress(videoId);
    setResumeProgress(nextResumeProgress);
    const nextIsPlaying = nextResumeProgress === null;
    isPlayingRef.current = nextIsPlaying;
    setIsPlaying(nextIsPlaying);
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
      if (event.key === ' ' || event.code === 'Space') {
        const iframe = playerRef.current?.querySelector<HTMLIFrameElement>('iframe') ?? null;
        // Space pressed while the iframe is focused is handled by YouTube's
        // native controls. Events from a cross-origin iframe do not bubble to
        // this window listener.
        if (document.activeElement === iframe) return;
        event.preventDefault();
        const nextIsPlaying = !isPlayingRef.current;
        isPlayingRef.current = nextIsPlaying;
        setIsPlaying(nextIsPlaying);
        sendPlayerCommand(
          iframe,
          nextIsPlaying ? 'playVideo' : 'pauseVideo',
        );
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
    // Keep keyboard playback controls in the YouTube iframe. Focusing the
    // speed button makes Space activate the 1x/2x toggle instead.
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
      <YoutubePlayer
        videoId={videoId}
        title={title}
        isTheaterOpen={isTheaterOpen}
        isDoubleSpeed={isDoubleSpeed}
        resumePosition={resumeProgress?.position ?? null}
        shellRef={playerRef}
        onPlaybackStateChange={(nextIsPlaying) => {
          isPlayingRef.current = nextIsPlaying;
          setIsPlaying(nextIsPlaying);
        }}
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
  onPlaybackStateChange: (isPlaying: boolean) => void;
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
  onPlaybackStateChange,
  onToggleTheater,
  onTogglePlaybackSpeed,
  shellRef,
}: YoutubePlayerProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({
    autoplay: resumePosition === null ? '1' : '0',
    rel: '0',
    enablejsapi: '1',
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<YoutubePlayer | null>(null);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const isDoubleSpeedRef = useRef(isDoubleSpeed);
  const resumeRequestedRef = useRef(false);
  const canPersistProgressRef = useRef(resumePosition === null);
  const currentTimeRef = useRef<number | null>(resumePosition);
  const durationRef = useRef<number | null>(null);
  isDoubleSpeedRef.current = isDoubleSpeed;
  const [isResumeAvailable, setIsResumeAvailable] = useState(resumePosition !== null);
  const [isResumeRequested, setIsResumeRequested] = useState(false);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  useEffect(() => {
    setIsResumeAvailable(resumePosition !== null);
    setIsResumeRequested(false);
    resumeRequestedRef.current = false;
    canPersistProgressRef.current = resumePosition === null;
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
    let isDisposed = false;
    let isPlayerAttached = false;

    const sampleProgress = (player: YoutubePlayer): boolean => {
      const position = player.getCurrentTime();
      const duration = player.getDuration();
      if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return false;
      currentTimeRef.current = position;
      durationRef.current = duration;
      latestProgressRef.current.position = position;
      latestProgressRef.current.duration = duration;
      return true;
    };

    const persistProgress = (force = false, player = youtubePlayerRef.current) => {
      if (!canPersistProgressRef.current || !player) return;
      if (!sampleProgress(player)) return;
      const latestProgress = latestProgressRef.current;
      if (latestProgress.position === undefined || latestProgress.duration === undefined) return;
      const now = Date.now();
      if (!force && now - lastPersistedAt < 4000) return;
      writeYoutubeProgress(videoId, latestProgress.position, latestProgress.duration);
      lastPersistedAt = now;
    };

    const handleStateChange = (event: YoutubePlayerStateChangeEvent) => {
      if (isDisposed) return;
      onPlaybackStateChangeRef.current(event.data === 1);
      if (event.data === 1) {
        canPersistProgressRef.current = true;
        setIsResumeAvailable(false);
      }
      if (event.data === 0 || event.data === 2) {
        persistProgress(true, event.target);
      } else {
        sampleProgress(event.target);
      }
    };

    const attachPlayer = () => {
      if (isDisposed || isPlayerAttached) return;
      isPlayerAttached = true;

      void loadYoutubeIframeApi()
        .then((api) => {
          if (isDisposed || !iframe.isConnected) return;
          const player = new api.Player(iframe, {
            events: {
              onReady: ({ target }) => {
                if (isDisposed) return;
                youtubePlayerRef.current = target;
                target.setPlaybackRate(isDoubleSpeedRef.current ? 2 : 1);
                sampleProgress(target);
                if (resumeRequestedRef.current && resumePosition !== null) {
                  target.seekTo(resumePosition, true);
                  target.playVideo();
                }
              },
              onStateChange: handleStateChange,
            },
          });
          youtubePlayerRef.current = player;
        })
        .catch(() => {
          // Keep the embedded player usable if the optional API cannot load.
        });
    };

    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistProgress(true);
    };
    const persistOnPageHide = () => persistProgress(true);
    const progressTimer = window.setInterval(() => persistProgress(), 5000);

    iframe.addEventListener('load', attachPlayer);
    attachPlayer();
    window.addEventListener('pagehide', persistOnPageHide);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      isDisposed = true;
      window.clearInterval(progressTimer);
      iframe.removeEventListener('load', attachPlayer);
      window.removeEventListener('pagehide', persistOnPageHide);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      persistProgress(true);
      youtubePlayerRef.current?.destroy();
      youtubePlayerRef.current = null;
    };
  }, [resumePosition, videoId]);

  useEffect(() => {
    const playerElement = shellRef.current;
    if (!playerElement) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (!playerElement.contains(document.activeElement)) return;

      const player = youtubePlayerRef.current;
      let currentTime = currentTimeRef.current;
      let duration = durationRef.current;
      if (player) {
        currentTime = player.getCurrentTime();
        duration = player.getDuration();
      }
      if (typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return;

      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const maxTime = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? duration
        : Number.POSITIVE_INFINITY;
      const nextTime = Math.max(
        0,
        Math.min(maxTime, currentTime + direction * YOUTUBE_SEEK_STEP_SECONDS),
      );
      currentTimeRef.current = nextTime;
      event.preventDefault();
      if (player) {
        player.seekTo(nextTime, true);
      } else {
        sendPlayerCommand(iframeRef.current, 'seekTo', [nextTime, true]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shellRef]);

  useEffect(() => {
    if (!isResumeRequested || resumePosition === null) return;
    resumeRequestedRef.current = true;
    canPersistProgressRef.current = true;
    const player = youtubePlayerRef.current;
    if (player) {
      player.seekTo(resumePosition, true);
      player.playVideo();
    } else {
      sendPlayerCommand(iframeRef.current, 'seekTo', [resumePosition, true]);
      sendPlayerCommand(iframeRef.current, 'playVideo');
    }
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
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || t('preview.youtubePlayer')}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            ref={iframeRef}
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
