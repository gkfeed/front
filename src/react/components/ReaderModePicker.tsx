import { useTranslation } from 'react-i18next';

import type { ReaderMode } from '../state/readerMode';

export function ReaderModePicker({
  readerMode,
  onReaderModeChange,
  itemRole = 'menuitemradio',
}: {
  readerMode: ReaderMode;
  onReaderModeChange: (mode: ReaderMode) => void;
  itemRole?: 'menuitemradio' | 'radio';
}) {
  const { t } = useTranslation();

  return (
    <div className="theme-picker__section">
      <span className="theme-picker__section-title">{t('settings.readerView')}</span>
      <div
        className="theme-picker__reader-options"
        role={itemRole === 'radio' ? 'radiogroup' : undefined}
        aria-label={itemRole === 'radio' ? t('settings.readerView') : undefined}
      >
        {(['review', 'scroll'] as const).map((mode) => {
          const selected = mode === readerMode;
          return (
            <button
              className="theme-picker__reader-option"
              data-selected={selected || undefined}
              key={mode}
              type="button"
              role={itemRole}
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
