import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

function getMainElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main');
}

function setFallbackFullscreen(enabled: boolean): void {
  if (enabled) document.documentElement.dataset.readerFullscreen = 'true';
  else delete document.documentElement.dataset.readerFullscreen;
}

function rememberReviewActionsSize(main: HTMLElement): void {
  const actions = document.querySelector<HTMLElement>('.reader__actions:not([hidden])');
  if (!actions) return;

  const { width, height } = actions.getBoundingClientRect();
  if (width > 0) main.style.setProperty('--reader-actions-width', `${width}px`);
  if (height > 0) main.style.setProperty('--reader-actions-height', `${height}px`);
}

function clearReviewActionsSize(main: HTMLElement | null): void {
  main?.style.removeProperty('--reader-actions-width');
  main?.style.removeProperty('--reader-actions-height');
}

export function ReaderFullscreenButton() {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  useEffect(() => {
    const main = getMainElement();
    const fullscreenMain = () => {
      const isNativeFullscreen = getFullscreenElement() === main;
      setIsFullscreen(isNativeFullscreen);
      if (!isNativeFullscreen) clearReviewActionsSize(main);
    };
    fullscreenMain();

    document.addEventListener('fullscreenchange', fullscreenMain);
    document.addEventListener('webkitfullscreenchange', fullscreenMain);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenMain);
      document.removeEventListener('webkitfullscreenchange', fullscreenMain);
      setFallbackFullscreen(false);
      clearReviewActionsSize(main);
    };
  }, []);

  async function toggleFullscreen() {
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
  }

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
