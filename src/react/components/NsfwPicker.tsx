import { useTranslation } from 'react-i18next';

import { useNsfwPreferences } from '../state/useNsfwPreferences';

export function NsfwPicker({ itemRole = 'menuitemradio' }: {
  itemRole?: 'menuitemradio' | 'radio';
} = {}) {
  const { t } = useTranslation();
  const { nsfwMode, setNsfwMode } = useNsfwPreferences();

  return (
    <div className="theme-picker__section">
      <span className="theme-picker__section-title">{t('settings.content')}</span>
      <span className="theme-picker__content-description">{t('settings.nsfwDescription')}</span>
      <div
        className="theme-picker__nsfw-options"
        role={itemRole === 'radio' ? 'radiogroup' : undefined}
        aria-label={itemRole === 'radio' ? t('settings.content') : undefined}
      >
        {([
          { mode: 'show', labelKey: 'settings.show', icon: '○' },
          { mode: 'blur', labelKey: 'settings.blur', icon: '◉' },
          { mode: 'hide', labelKey: 'settings.hide', icon: '⊘' },
        ] as const).map((option) => {
          const selected = option.mode === nsfwMode;
          return (
            <button
              className="theme-picker__nsfw-option"
              data-selected={selected || undefined}
              key={option.mode}
              type="button"
              role={itemRole}
              aria-checked={selected}
              onClick={() => setNsfwMode(option.mode)}
            >
              <span aria-hidden="true">{option.icon}</span>
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
