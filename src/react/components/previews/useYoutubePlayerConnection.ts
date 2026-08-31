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
  onPlaybackStarted,
  persistProgress,
  playerRef,
  resumePosition,
  resumeRequestedRef,
  sampleProgress,
  videoId,
}: {
  canPersistRef: { current: boolean };
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isDoubleSpeedRef: { current: boolean };
  onPlaybackStateChangeRef: { current: (isPlaying: boolean) => void };
  onPlaybackStarted: () => void;
  persistProgress: (force: boolean, player: YoutubePlayer) => void;
  playerRef: { current: YoutubePlayer | null };
  resumePosition: number | null;
  resumeRequestedRef: { current: boolean };
  sampleProgress: (player: YoutubePlayer) => void;
  videoId: string;
}): void {
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
        onPlaybackStarted();
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
  }, [
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
  ]);
}
