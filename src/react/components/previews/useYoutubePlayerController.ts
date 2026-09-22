import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { YoutubePlayer } from '../../services/youtubeIframeApi';
import { useYoutubeProgressPersistence } from './useYoutubeProgressPersistence';
import { useYoutubePlayerConnection } from './useYoutubePlayerConnection';
import { useYoutubePlayerKeyboard } from './useYoutubePlayerKeyboard';
import { useYoutubePlayerRate } from './useYoutubePlayerRate';
import { sendPlayerCommand } from './youtubePlayerProtocol';

export function useYoutubePlayerController({
  isDoubleSpeed,
  onPlaybackStateChange,
  onPlayerUnavailable,
  resumePosition,
  shellRef,
  videoId,
}: {
  isDoubleSpeed: boolean;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onPlayerUnavailable: () => void;
  resumePosition: number | null;
  shellRef: RefObject<HTMLDivElement | null>;
  videoId: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const isDoubleSpeedRef = useRef(isDoubleSpeed);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const [currentTime, setCurrentTime] = useState(resumePosition ?? 0);
  isDoubleSpeedRef.current = isDoubleSpeed;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  useEffect(() => setCurrentTime(resumePosition ?? 0), [resumePosition, videoId]);

  const {
    canPersistRef,
    currentTimeRef,
    durationRef,
    persistProgress,
    sampleProgress,
  } = useYoutubeProgressPersistence({ playerRef, resumePosition, videoId });
  const samplePlayerProgress = useCallback((player: YoutubePlayer) => {
    const sampled = sampleProgress(player);
    if (sampled && currentTimeRef.current !== null) setCurrentTime(currentTimeRef.current);
  }, [currentTimeRef, sampleProgress]);

  useYoutubePlayerRate(iframeRef, isDoubleSpeed);
  useYoutubePlayerConnection({
    canPersistRef,
    iframeRef,
    isDoubleSpeedRef,
    onPlaybackStateChangeRef,
    onPlayerUnavailable,
    persistProgress,
    playerRef,
    resumePosition,
    sampleProgress: samplePlayerProgress,
    videoId,
  });
  useYoutubePlayerKeyboard({
    currentTimeRef,
    durationRef,
    iframeRef,
    playerRef,
    shellRef,
  });

  useEffect(() => {
    const updateCurrentTime = () => {
      const time = playerRef.current?.getCurrentTime();
      if (typeof time !== 'number' || !Number.isFinite(time)) return;
      setCurrentTime((current) => Math.abs(current - time) < 0.25 ? current : time);
    };
    updateCurrentTime();
    const timer = window.setInterval(updateCurrentTime, 1000);
    return () => window.clearInterval(timer);
  }, [playerRef, videoId]);

  const seekTo = useCallback((seconds: number) => {
    currentTimeRef.current = seconds;
    setCurrentTime(seconds);
    if (playerRef.current) playerRef.current.seekTo(seconds, true);
    else sendPlayerCommand(iframeRef.current, 'seekTo', [seconds, true]);
  }, [currentTimeRef]);

  return { currentTime, iframeRef, seekTo };
}
