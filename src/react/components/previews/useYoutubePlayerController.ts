import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  loadYoutubeIframeApi,
  type YoutubePlayer,
  type YoutubePlayerStateChangeEvent,
} from '../../services/youtubeIframeApi';
import { useYoutubeProgressPersistence } from './useYoutubeProgressPersistence';

const YOUTUBE_SEEK_STEP_SECONDS = 5;

export function useYoutubePlayerController({
  isDoubleSpeed,
  onPlaybackStateChange,
  resumePosition,
  shellRef,
  videoId,
}: {
  isDoubleSpeed: boolean;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  resumePosition: number | null;
  shellRef: RefObject<HTMLDivElement | null>;
  videoId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const isDoubleSpeedRef = useRef(isDoubleSpeed);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const resumeRequestedRef = useRef(false);
  const [isResumeAvailable, setIsResumeAvailable] = useState(resumePosition !== null);
  const [isResumeRequested, setIsResumeRequested] = useState(false);
  isDoubleSpeedRef.current = isDoubleSpeed;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const {
    canPersistRef,
    currentTimeRef,
    durationRef,
    persistProgress,
    sampleProgress,
  } = useYoutubeProgressPersistence({ playerRef, resumePosition, videoId });

  useEffect(() => {
    setIsResumeAvailable(resumePosition !== null);
    setIsResumeRequested(false);
    resumeRequestedRef.current = false;
  }, [resumePosition]);

  useEffect(() => {
    const sendCurrentPlaybackRate = () => sendPlaybackRate(
      iframeRef.current,
      isDoubleSpeed ? 2 : 1,
    );
    const retryTimers = [300, 1000].map((delay) => window.setTimeout(
      sendCurrentPlaybackRate,
      delay,
    ));
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [isDoubleSpeed]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let isDisposed = false;
    let isPlayerAttached = false;

    const handleStateChange = (event: YoutubePlayerStateChangeEvent) => {
      if (isDisposed) return;
      onPlaybackStateChangeRef.current(event.data === 1);
      if (event.data === 1) {
        canPersistRef.current = true;
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
                playerRef.current = target;
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
          playerRef.current = player;
        })
        .catch(() => {
          // Keep the embedded player usable if the optional API cannot load.
        });
    };

    iframe.addEventListener('load', attachPlayer);
    attachPlayer();
    return () => {
      isDisposed = true;
      iframe.removeEventListener('load', attachPlayer);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [canPersistRef, persistProgress, resumePosition, sampleProgress, videoId]);

  useEffect(() => {
    const playerElement = shellRef.current;
    if (!playerElement) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (!playerElement.contains(document.activeElement)) return;
      const player = playerRef.current;
      const currentTime = player ? player.getCurrentTime() : currentTimeRef.current;
      const duration = player ? player.getDuration() : durationRef.current;
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
      if (player) player.seekTo(nextTime, true);
      else sendPlayerCommand(iframeRef.current, 'seekTo', [nextTime, true]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTimeRef, durationRef, shellRef]);

  useEffect(() => {
    if (!isResumeRequested || resumePosition === null) return;
    resumeRequestedRef.current = true;
    canPersistRef.current = true;
    const player = playerRef.current;
    if (player) {
      player.seekTo(resumePosition, true);
      player.playVideo();
    } else {
      sendPlayerCommand(iframeRef.current, 'seekTo', [resumePosition, true]);
      sendPlayerCommand(iframeRef.current, 'playVideo');
    }
  }, [canPersistRef, isResumeRequested, resumePosition]);

  const resume = useCallback(() => {
    setIsResumeAvailable(false);
    setIsResumeRequested(true);
  }, []);

  return { iframeRef, isResumeAvailable, resume };
}

export function sendPlaybackRate(
  iframe: HTMLIFrameElement | null,
  playbackRate: number,
): void {
  sendPlayerCommand(iframe, 'setPlaybackRate', [playbackRate]);
}

export function sendPlayerCommand(
  iframe: HTMLIFrameElement | null,
  func: 'playVideo' | 'pauseVideo' | 'setPlaybackRate' | 'seekTo',
  args: unknown[] = [],
): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}
