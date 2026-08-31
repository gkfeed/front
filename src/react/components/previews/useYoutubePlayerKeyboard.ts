import { useEffect, type RefObject } from 'react';

import type { YoutubePlayer } from '../../services/youtubeIframeApi';
import { sendPlayerCommand } from './youtubePlayerProtocol';

const YOUTUBE_SEEK_STEP_SECONDS = 5;

export function useYoutubePlayerKeyboard({
  currentTimeRef,
  durationRef,
  iframeRef,
  playerRef,
  shellRef,
}: {
  currentTimeRef: { current: number | null };
  durationRef: { current: number | null };
  iframeRef: RefObject<HTMLIFrameElement | null>;
  playerRef: { current: YoutubePlayer | null };
  shellRef: RefObject<HTMLDivElement | null>;
}): void {
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
  }, [currentTimeRef, durationRef, iframeRef, playerRef, shellRef]);
}
