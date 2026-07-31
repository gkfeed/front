import { useTranslation } from 'react-i18next';

import type { ReaderMode } from '../state/readerMode';

export function ReaderModePicker({
  readerMode,
  onReaderModeChange,
}: {
  readerMode: ReaderMode;
  onReaderModeChange: (mode: ReaderMode) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="theme-picker__section">
      <span className="theme-picker__section-title">{t('settings.readerView')}</span>
      <div className="theme-picker__reader-options">
        {(['review', 'scroll'] as const).map((mode) => {
          const selected = mode === readerMode;
          return (
            <button
              className="theme-picker__reader-option"
              data-selected={selected || undefined}
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onReaderModeChange(mode)}
            >
              <span aria-hidden="true">{mode === 'review' ? '✓' : '↕'}</span>
              {mode === 'review' ? t('settings.review') : t('settings.scroll')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
