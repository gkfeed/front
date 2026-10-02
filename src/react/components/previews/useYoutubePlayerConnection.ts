import { useEffect, type RefObject } from 'react';

import {
  loadYoutubeIframeApi,
  type YoutubePlayer,
  type YoutubePlayerStateChangeEvent,
} from '../../services/youtubeIframeApi';

export function useYoutubePlayerConnection({
  canPersistRef,
  iframeRef,
  isDoubleSpeedRef,
  onPlaybackStateChangeRef,
  onPlayerUnavailable,
  persistProgress,
  playerRef,
  resumePosition,
  sampleProgress,
  videoId,
}: {
  canPersistRef: { current: boolean };
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isDoubleSpeedRef: { current: boolean };
  onPlaybackStateChangeRef: { current: (isPlaying: boolean) => void };
  onPlayerUnavailable: () => void;
  persistProgress: (force: boolean, player: YoutubePlayer) => void;
  playerRef: { current: YoutubePlayer | null };
  resumePosition: number | null;
  sampleProgress: (player: YoutubePlayer) => void;
  videoId: string;
}): void {
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let isDisposed = false;
    let isPlayerAttached = false;
    let readinessTimeout: number | undefined;

    const handleStateChange = (event: YoutubePlayerStateChangeEvent) => {
      if (isDisposed) return;
      onPlaybackStateChangeRef.current(event.data === 1);
      if (event.data === 1) {
        canPersistRef.current = true;
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
          readinessTimeout = window.setTimeout(() => {
            if (!isDisposed) onPlayerUnavailable();
          }, 10_000);
          const player = new api.Player(iframe, {
            events: {
              onError: () => {
                if (isDisposed) return;
                window.clearTimeout(readinessTimeout);
                onPlayerUnavailable();
              },
              onReady: ({ target }) => {
                if (isDisposed) return;
                window.clearTimeout(readinessTimeout);
                playerRef.current = target;
                target.setPlaybackRate(isDoubleSpeedRef.current ? 2 : 1);
                sampleProgress(target);
                if (resumePosition !== null) {
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
      window.clearTimeout(readinessTimeout);
      iframe.removeEventListener('load', attachPlayer);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [
    canPersistRef,
    iframeRef,
    isDoubleSpeedRef,
    onPlaybackStateChangeRef,
    onPlayerUnavailable,
    persistProgress,
    playerRef,
    resumePosition,
    sampleProgress,
    videoId,
  ]);
}
