import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { HlsConfig } from 'hls.js';

export function useHlsVideo({
  config,
  onFatalError,
  src,
  videoRef,
}: {
  config?: Partial<HlsConfig>;
  onFatalError?: () => void;
  src: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let destroyPlayer: (() => void) | undefined;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      void import('hls.js').then(({ default: Hls }) => {
        if (!active || !Hls.isSupported()) {
          if (active) onFatalErrorRef.current?.();
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
    }

    return () => {
      active = false;
      destroyPlayer?.();
      video.removeAttribute('src');
    };
  }, [config, src, videoRef]);
}
