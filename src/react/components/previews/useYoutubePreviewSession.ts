import { useCallback, useEffect, useRef, useState } from 'react';

import { readYoutubeProgress } from '../../services/youtubeProgress';
import { useTheaterDialog } from './useTheaterDialog';

export function useYoutubePreviewSession(videoId: string) {
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

  const handleTheaterChange = useCallback((isOpen: boolean) => {
    setIsTheaterOpen(isOpen);
  }, []);
  const handlePlaybackChange = useCallback((nextIsPlaying: boolean) => {
    isPlayingRef.current = nextIsPlaying;
    setIsPlaying(nextIsPlaying);
  }, []);

  useTheaterDialog({
    isOpen: isTheaterOpen,
    isPlayingRef,
    onOpenChange: handleTheaterChange,
    onPlaybackChange: handlePlaybackChange,
    playerRef,
    triggerRef,
  });

  return {
    isPlayerOpen,
    isTheaterOpen,
    isDoubleSpeed,
    resumePosition: resumeProgress?.position ?? null,
    triggerRef,
    playerRef,
    handlePlaybackChange,
    openPlayer: useCallback(() => {
      setIsPlayerOpen(true);
      setIsTheaterOpen(true);
    }, []),
    toggleTheater: useCallback(() => {
      setIsTheaterOpen((isOpen) => !isOpen);
    }, []),
    togglePlaybackSpeed: useCallback(() => {
      setIsDoubleSpeed((currentSpeed) => !currentSpeed);
    }, []),
  };
}
