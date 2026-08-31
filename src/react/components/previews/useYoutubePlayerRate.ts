import { useEffect, type RefObject } from 'react';

import { sendPlaybackRate } from './youtubePlayerProtocol';

export function useYoutubePlayerRate(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  isDoubleSpeed: boolean,
): void {
  useEffect(() => {
    const sendCurrentPlaybackRate = () => sendPlaybackRate(
      iframeRef.current,
      isDoubleSpeed ? 2 : 1,
    );
    const retryTimers = [300, 1000].map((delay) => window.setTimeout(
      sendCurrentPlaybackRate,
      delay,
    ));
    return () => retryTimers.forEach((timer) => window.clearTimeout(timer));
  }, [iframeRef, isDoubleSpeed]);
}
