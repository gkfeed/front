import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { YoutubePlayer } from '../../services/youtubeIframeApi';
import { writeYoutubeProgress } from '../../services/youtubeProgress';

export function useYoutubeProgressPersistence({
  playerRef,
  resumePosition,
  videoId,
}: {
  playerRef: RefObject<YoutubePlayer | null>;
  resumePosition: number | null;
  videoId: string;
}) {
  const canPersistRef = useRef(resumePosition === null);
  const currentTimeRef = useRef<number | null>(resumePosition);
  const durationRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);

  useEffect(() => {
    canPersistRef.current = resumePosition === null;
    currentTimeRef.current = resumePosition;
    durationRef.current = null;
    lastPersistedAtRef.current = 0;
  }, [resumePosition, videoId]);

  const sampleProgress = useCallback((player: YoutubePlayer): boolean => {
    const position = player.getCurrentTime();
    const duration = player.getDuration();
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return false;
    currentTimeRef.current = position;
    durationRef.current = duration;
    return true;
  }, []);

  const persistProgress = useCallback((force = false, player = playerRef.current) => {
    if (!canPersistRef.current || !player || !sampleProgress(player)) return;
    const position = currentTimeRef.current;
    const duration = durationRef.current;
    if (position === null || duration === null) return;
    const now = Date.now();
    if (!force && now - lastPersistedAtRef.current < 4000) return;
    writeYoutubeProgress(videoId, position, duration);
    lastPersistedAtRef.current = now;
  }, [playerRef, sampleProgress, videoId]);

  useEffect(() => {
    const persistWhenHidden = () => {
      if (document.visibilityState === 'hidden') persistProgress(true);
    };
    const persistOnPageHide = () => persistProgress(true);
    const progressTimer = window.setInterval(() => persistProgress(), 5000);
    window.addEventListener('pagehide', persistOnPageHide);
    document.addEventListener('visibilitychange', persistWhenHidden);
    return () => {
      window.clearInterval(progressTimer);
      window.removeEventListener('pagehide', persistOnPageHide);
      document.removeEventListener('visibilitychange', persistWhenHidden);
      persistProgress(true);
    };
  }, [persistProgress]);

  return {
    canPersistRef,
    currentTimeRef,
    durationRef,
    persistProgress,
    sampleProgress,
  };
}
