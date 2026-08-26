import { useTranslation } from 'react-i18next';

import { useTikTokPreviewPreferences } from '../state/useTikTokPreviewPreferences';

export function TikTokPreviewModePicker() {
  const { t } = useTranslation();
  const { mode, setMode } = useTikTokPreviewPreferences();

  return (
    <div className="theme-picker__section settings-page__tiktok">
      <span className="theme-picker__section-title">{t('settings.tiktokPreview')}</span>
      <span className="theme-picker__content-description">
        {t('settings.tiktokPreviewDescription')}
      </span>
      <div className="settings-page__choice-grid" role="radiogroup" aria-label={t('settings.tiktokPreview')}>
        {([
          {
            value: 'embed',
            icon: '↗',
            label: t('settings.tiktokEmbed'),
            description: t('settings.tiktokEmbedDescription'),
          },
          {
            value: 'broker',
            icon: '↓',
            label: t('settings.tiktokBroker'),
            description: t('settings.tiktokBrokerDescription'),
          },
        ] as const).map((option) => {
          const selected = option.value === mode;
          return (
            <button
              className="settings-page__choice"
              data-selected={selected || undefined}
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(option.value)}
            >
              <span className="settings-page__choice-icon" aria-hidden="true">{option.icon}</span>
              <span className="settings-page__choice-copy">
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="settings-page__choice-check" aria-hidden="true">✓</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
