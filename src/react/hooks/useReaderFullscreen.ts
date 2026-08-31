import { useCallback, useEffect, useState } from 'react';

import {
  FALLBACK_FULLSCREEN_EVENT,
  clearReviewActionsSize,
  type FullscreenDocument,
  type FullscreenElement,
  getFullscreenElement,
  getMainElement,
  rememberReviewActionsSize,
  setFallbackFullscreen,
  setNativeFullscreenAttribute,
} from '../platform/readerFullscreen';

export function useReaderFullscreen(enableKeyboardShortcut: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(
    () => document.documentElement.dataset.readerFullscreen === 'true',
  );

  useEffect(() => {
    const main = getMainElement();
    const syncNativeFullscreen = () => {
      const isNativeFullscreen = getFullscreenElement() === main;
      setNativeFullscreenAttribute(main, isNativeFullscreen);
      syncFullscreenState(isNativeFullscreen);
    };
    const syncFallbackFullscreen = () => {
      syncFullscreenState(getFullscreenElement() === main);
    };
    const syncFullscreenState = (isNativeFullscreen: boolean) => {
      const isFallback = document.documentElement.dataset.readerFullscreen === 'true';
      setIsFallbackFullscreen(isFallback);
      setIsFullscreen(isNativeFullscreen || isFallback);
      if (!isNativeFullscreen && !isFallback) clearReviewActionsSize(main);
    };
    syncNativeFullscreen();

    document.addEventListener('fullscreenchange', syncNativeFullscreen);
    document.addEventListener('webkitfullscreenchange', syncNativeFullscreen);
    document.addEventListener(FALLBACK_FULLSCREEN_EVENT, syncFallbackFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncNativeFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncNativeFullscreen);
      document.removeEventListener(FALLBACK_FULLSCREEN_EVENT, syncFallbackFullscreen);
      setNativeFullscreenAttribute(main, false);
      setFallbackFullscreen(false);
      clearReviewActionsSize(main);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const main = getMainElement();
    if (!main) return;

    const fullscreenDocument = document as FullscreenDocument;
    if (isFallbackFullscreen) {
      setFallbackFullscreen(false);
      setIsFallbackFullscreen(false);
      setIsFullscreen(false);
      clearReviewActionsSize(main);
      return;
    }

    rememberReviewActionsSize(main);
    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (fullscreenDocument.webkitExitFullscreen) await fullscreenDocument.webkitExitFullscreen();
        return;
      }

      const fullscreenElement = main as FullscreenElement;
      if (fullscreenElement.requestFullscreen) await fullscreenElement.requestFullscreen();
      else if (fullscreenElement.webkitRequestFullscreen) await fullscreenElement.webkitRequestFullscreen();
      else throw new Error('Fullscreen API is unavailable');
    } catch {
      // Some iPad browsers do not expose fullscreen for arbitrary HTML elements.
      setFallbackFullscreen(true);
      setIsFallbackFullscreen(true);
      setIsFullscreen(true);
    }
  }, [isFallbackFullscreen]);

  useEffect(() => {
    if (!enableKeyboardShortcut) return;
    const toggleOnKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'f'
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || isTextEntryTarget(event.target)
      ) return;

      event.preventDefault();
      void toggleFullscreen();
    };
    window.addEventListener('keydown', toggleOnKeyDown);
    return () => window.removeEventListener('keydown', toggleOnKeyDown);
  }, [enableKeyboardShortcut, toggleFullscreen]);

  useEffect(() => {
    if (!isFallbackFullscreen) return;
    const main = getMainElement();
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setFallbackFullscreen(false);
      setIsFallbackFullscreen(false);
      setIsFullscreen(false);
      clearReviewActionsSize(main);
    };
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [isFallbackFullscreen]);

  return { isFullscreen, toggleFullscreen };
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}
