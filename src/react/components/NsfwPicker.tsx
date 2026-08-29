import { useTranslation } from 'react-i18next';

import { useNsfwPreferences } from '../state/useNsfwPreferences';

export function NsfwPicker() {
  const { t } = useTranslation();
  const { nsfwMode, setNsfwMode } = useNsfwPreferences();

  return (
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.content')}</span>
      <span className="settings-menu__content-description">{t('settings.nsfwDescription')}</span>
      <div className="settings-menu__nsfw-options">
        {([
          { mode: 'show', labelKey: 'settings.show', icon: '○' },
          { mode: 'blur', labelKey: 'settings.blur', icon: '◉' },
          { mode: 'hide', labelKey: 'settings.hide', icon: '⊘' },
        ] as const).map((option) => {
          const selected = option.mode === nsfwMode;
          return (
            <button
              className="settings-menu__nsfw-option"
              data-selected={selected || undefined}
              key={option.mode}
              type="button"
              role="menuitemradio"
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
