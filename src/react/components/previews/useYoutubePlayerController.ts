import { useRef } from 'react';
import type { RefObject } from 'react';

import type { YoutubePlayer } from '../../services/youtubeIframeApi';
import { useYoutubeProgressPersistence } from './useYoutubeProgressPersistence';
import { useYoutubePlayerConnection } from './useYoutubePlayerConnection';
import { useYoutubePlayerKeyboard } from './useYoutubePlayerKeyboard';
import { useYoutubePlayerRate } from './useYoutubePlayerRate';

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
  isDoubleSpeedRef.current = isDoubleSpeed;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const {
    canPersistRef,
    currentTimeRef,
    durationRef,
    persistProgress,
    sampleProgress,
  } = useYoutubeProgressPersistence({ playerRef, resumePosition, videoId });

  useYoutubePlayerRate(iframeRef, isDoubleSpeed);
  useYoutubePlayerConnection({
    canPersistRef,
    iframeRef,
    isDoubleSpeedRef,
    onPlaybackStateChangeRef,
    persistProgress,
    playerRef,
    resumePosition,
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

  return { iframeRef };
}
