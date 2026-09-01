import { useTranslation } from 'react-i18next';

import { useTikTokPreferences } from '../state/useTikTokPreferences';

export function TikTokPicker() {
  const { t } = useTranslation();
  const { hideTikTokItems, setHideTikTokItems } = useTikTokPreferences();

  return (
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.tiktokItems')}</span>
      <span className="settings-menu__content-description">{t('settings.tiktokDescription')}</span>
      <div className="settings-menu__tiktok-options">
        {([
          { hide: false, labelKey: 'settings.showTikTok', icon: '○' },
          { hide: true, labelKey: 'settings.hideTikTok', icon: '⊘' },
        ] as const).map((option) => {
          const selected = option.hide === hideTikTokItems;
          return (
            <button
              className="settings-menu__tiktok-option"
              data-selected={selected || undefined}
              key={String(option.hide)}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => setHideTikTokItems(option.hide)}
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
