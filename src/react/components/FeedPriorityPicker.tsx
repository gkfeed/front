import { useTranslation } from 'react-i18next';

import { useFeedPriority } from '../state/useFeedPriority';

export function FeedPriorityPicker() {
  const { t } = useTranslation();
  const { isEnabled, setEnabled } = useFeedPriority();

  return (
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.feedPrioritization')}</span>
      <span className="settings-menu__content-description">
        {t('settings.feedPrioritizationDescription')}
      </span>
      <div className="settings-menu__reader-options">
        {([true, false] as const).map((enabled) => (
          <button
            className="settings-menu__reader-option"
            data-selected={enabled === isEnabled || undefined}
            key={String(enabled)}
            type="button"
            role="menuitemradio"
            aria-checked={enabled === isEnabled}
            onClick={() => setEnabled(enabled)}
          >
            {t(enabled ? 'settings.enabled' : 'settings.disabled')}
          </button>
        ))}
      </div>
    </div>
  );
}
