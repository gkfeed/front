import { useCallback, useEffect, useRef, useState } from 'react';

import { readYoutubeProgress } from '../../services/youtubeProgress';
import { useTheaterDialog } from './useTheaterDialog';
import { sendPlayerCommand } from './useYoutubePlayerController';

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
  const handleTheaterKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key !== ' ' && event.code !== 'Space') return false;
    const iframe = playerRef.current?.querySelector<HTMLIFrameElement>('iframe') ?? null;
    if (document.activeElement === iframe) return false;
    event.preventDefault();
    const nextIsPlaying = !isPlayingRef.current;
    handlePlaybackChange(nextIsPlaying);
    sendPlayerCommand(iframe, nextIsPlaying ? 'playVideo' : 'pauseVideo');
    return true;
  }, [handlePlaybackChange]);

  useTheaterDialog({
    isOpen: isTheaterOpen,
    onKeyDown: handleTheaterKeyDown,
    onOpenChange: handleTheaterChange,
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
