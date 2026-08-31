import { useTranslation } from 'react-i18next';

import '../../styles/reader-fullscreen-button.css';
import { useReaderFullscreen } from '../hooks/useReaderFullscreen';

export function ReaderFullscreenButton({ enableKeyboardShortcut = false }: {
  enableKeyboardShortcut?: boolean;
} = {}) {
  const { t } = useTranslation();
  const { isFullscreen, toggleFullscreen } = useReaderFullscreen(enableKeyboardShortcut);
  return (
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
}
