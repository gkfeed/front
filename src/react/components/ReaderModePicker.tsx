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
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.readerView')}</span>
      <div className="settings-menu__reader-options">
        {(['review', 'scroll'] as const).map((mode) => {
          const selected = mode === readerMode;
          return (
            <button
              className="settings-menu__reader-option"
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
