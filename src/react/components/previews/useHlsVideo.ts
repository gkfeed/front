import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { HlsConfig } from 'hls.js';

export function useHlsVideo({
  config,
  enabled = true,
  onFatalError,
  src,
  videoRef,
}: {
  config?: Partial<HlsConfig>;
  enabled?: boolean;
  onFatalError?: () => void;
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let destroyPlayer: (() => void) | undefined;

    // Chrome can report native HLS support while failing to play the stream.
    // Prefer HLS.js and use native playback when MediaSource is unavailable.
    void import('hls.js').then(({ default: Hls }) => {
      if (!active) return;
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src;
        else onFatalErrorRef.current?.();
        return;
      }
      const hls = new Hls(config);
      destroyPlayer = () => hls.destroy();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (active && data.fatal) onFatalErrorRef.current?.();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    }).catch(() => {
      if (active) onFatalErrorRef.current?.();
    });

    return () => {
      active = false;
      destroyPlayer?.();
      video.removeAttribute('src');
    };
  }, [config, enabled, src, videoRef]);
}
