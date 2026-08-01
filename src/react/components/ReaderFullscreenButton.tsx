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

export function ReaderFullscreenButton() {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const main = getMainElement();
    const fullscreenMain = () => setIsFullscreen(getFullscreenElement() === main);
    const fullscreenElement = main as FullscreenElement | null;

    setIsSupported(Boolean(
      fullscreenElement
      && (typeof fullscreenElement.requestFullscreen === 'function'
        || typeof fullscreenElement.webkitRequestFullscreen === 'function'),
    ));
    fullscreenMain();

    document.addEventListener('fullscreenchange', fullscreenMain);
    document.addEventListener('webkitfullscreenchange', fullscreenMain);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenMain);
      document.removeEventListener('webkitfullscreenchange', fullscreenMain);
    };
  }, []);

  async function toggleFullscreen() {
    const main = getMainElement();
    if (!main) return;

    const fullscreenDocument = document as FullscreenDocument;
    try {
      if (getFullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (fullscreenDocument.webkitExitFullscreen) await fullscreenDocument.webkitExitFullscreen();
        return;
      }

      const fullscreenElement = main as FullscreenElement;
      if (fullscreenElement.requestFullscreen) await fullscreenElement.requestFullscreen();
      else if (fullscreenElement.webkitRequestFullscreen) await fullscreenElement.webkitRequestFullscreen();
    } catch {
      // Fullscreen can be rejected by the browser or the current document context.
    }
  }

  return (
    <button
      className="reader-fullscreen"
      type="button"
      aria-label={t(isFullscreen ? 'reader.exitFullscreen' : 'reader.enterFullscreen')}
      aria-pressed={isFullscreen}
      disabled={!isSupported}
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
}
