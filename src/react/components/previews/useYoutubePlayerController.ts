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

  const onPlaybackStarted = useCallback(() => {
    setIsResumeAvailable(false);
  }, []);
  useYoutubePlayerRate(iframeRef, isDoubleSpeed);
  useYoutubePlayerConnection({
    canPersistRef,
    iframeRef,
    isDoubleSpeedRef,
    onPlaybackStateChangeRef,
    onPlaybackStarted,
    persistProgress,
    playerRef,
    resumePosition,
    resumeRequestedRef,
    sampleProgress,
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
