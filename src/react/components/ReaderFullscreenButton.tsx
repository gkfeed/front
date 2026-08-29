import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../styles/reader-fullscreen-button.css';

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
} from '../services/readerFullscreen';

export function ReaderFullscreenButton({ enableKeyboardShortcut = false }: {
  enableKeyboardShortcut?: boolean;
} = {}) {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(
    () => document.documentElement.dataset.readerFullscreen === 'true',
  );

  useEffect(() => {
    const main = getMainElement();
    const fullscreenMain = () => {
      const isNativeFullscreen = getFullscreenElement() === main;
      setNativeFullscreenAttribute(main, isNativeFullscreen);
      const isFallback = document.documentElement.dataset.readerFullscreen === 'true';
      setIsFallbackFullscreen(isFallback);
      setIsFullscreen(isNativeFullscreen || isFallback);
      if (!isNativeFullscreen && !isFallback) clearReviewActionsSize(main);
    };
    const fallbackFullscreen = () => {
      const isFallback = document.documentElement.dataset.readerFullscreen === 'true';
      setIsFallbackFullscreen(isFallback);
      setIsFullscreen(isFallback || getFullscreenElement() === main);
      if (!isFallback && getFullscreenElement() !== main) clearReviewActionsSize(main);
    };
    fullscreenMain();

    document.addEventListener('fullscreenchange', fullscreenMain);
    document.addEventListener('webkitfullscreenchange', fullscreenMain);
    document.addEventListener(FALLBACK_FULLSCREEN_EVENT, fallbackFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenMain);
      document.removeEventListener('webkitfullscreenchange', fullscreenMain);
      document.removeEventListener(FALLBACK_FULLSCREEN_EVENT, fallbackFullscreen);
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
      ) {
        return;
      }

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

  const button = (
    <button
      className="reader-fullscreen"
      type="button"
      aria-label={t(isFullscreen ? 'reader.exitFullscreen' : 'reader.enterFullscreen')}
      aria-pressed={isFullscreen}
      onClick={() => void toggleFullscreen()}
    >
      <svg className="reader-fullscreen__icon" viewBox="0 0 24 24" aria-hidden="true">
        {isFullscreen ? (
          <path d="M8.5 3.5v5h-5M15.5 20.5v-5h5M3.5 15.5h5v5M20.5 8.5h-5v-5" />
        ) : (
          <path d="M3.5 8.5v-5h5M20.5 15.5v5h-5M8.5 20.5h-5v-5M15.5 3.5h5v5" />
        )}
      </svg>
    </button>
  );

  return button;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}
