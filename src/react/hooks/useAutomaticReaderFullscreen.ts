import { useEffect, useRef, useState } from 'react';

import {
  FALLBACK_FULLSCREEN_EVENT,
  exitReaderFullscreen,
  getMainElement,
  isAutomaticFallbackFullscreen,
  isReaderFullscreen,
  setAutomaticFallbackFullscreen,
} from '../platform/readerFullscreen';

const MOBILE_VIEWPORT_MAX_WIDTH = 640;

export function useAutomaticReaderFullscreen({
  itemId,
  shouldEnterAutomatically,
}: {
  itemId: number;
  shouldEnterAutomatically: boolean;
}): boolean {
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [isFullscreen, setIsFullscreen] = useState(isReaderFullscreen);
  const wasFullscreenRef = useRef(isReaderFullscreen());
  const automaticFullscreenDismissedRef = useRef(false);

  useEffect(() => {
    const updateFullscreenState = () => {
      const nextIsFullscreen = isReaderFullscreen();
      if (wasFullscreenRef.current && !nextIsFullscreen && shouldEnterAutomatically) {
        automaticFullscreenDismissedRef.current = true;
      }
      wasFullscreenRef.current = nextIsFullscreen;
      setIsFullscreen(nextIsFullscreen);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener(FALLBACK_FULLSCREEN_EVENT, updateFullscreenState);
    updateFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
      document.removeEventListener(FALLBACK_FULLSCREEN_EVENT, updateFullscreenState);
    };
  }, [shouldEnterAutomatically]);

  useEffect(() => {
    if (
      !shouldEnterAutomatically
      || !isMobileViewport
      || !getMainElement()
      || isReaderFullscreen()
      || automaticFullscreenDismissedRef.current
    ) return;

    // Native fullscreen requires a user gesture in Chromium and Safari. The
    // reader's fallback is the reliable automatic mobile fullscreen mode.
    setAutomaticFallbackFullscreen(true);
  }, [isMobileViewport, itemId, shouldEnterAutomatically]);

  useEffect(() => {
    if (shouldEnterAutomatically && isMobileViewport) return;
    if (!isAutomaticFallbackFullscreen() || !isReaderFullscreen()) return;
    void exitReaderFullscreen();
  }, [isMobileViewport, shouldEnterAutomatically]);

  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(getIsMobileViewport());
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  return isFullscreen;
}

function getIsMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH;
}
