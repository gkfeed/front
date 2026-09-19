import { useTranslation } from 'react-i18next';

import { useFeedPriority } from '../state/useFeedPriority';

export function FeedPriorityPicker() {
  const { t } = useTranslation();
  const {
    isManualEnabled,
    isAutomaticEnabled,
    setManualEnabled,
    setAutomaticEnabled,
  } = useFeedPriority();

  return (
    <>
      <PriorityToggle
        title={t('settings.manualFeedPrioritization')}
        description={t('settings.manualFeedPrioritizationDescription')}
        isEnabled={isManualEnabled}
        onChange={setManualEnabled}
      />
      <PriorityToggle
        title={t('settings.automaticFeedPrioritization')}
        description={t('settings.automaticFeedPrioritizationDescription')}
        isEnabled={isAutomaticEnabled}
        onChange={setAutomaticEnabled}
      />
    </>
  );
}

function PriorityToggle({
  title,
  description,
  isEnabled,
  onChange,
}: {
  title: string;
  description: string;
  isEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="settings-menu__section" role="group" aria-label={title}>
      <span className="settings-menu__section-title">{title}</span>
      <span className="settings-menu__content-description">{description}</span>
      <div className="settings-menu__reader-options">
        {([true, false] as const).map((enabled) => (
          <button
            className="settings-menu__reader-option"
            data-selected={enabled === isEnabled || undefined}
            key={String(enabled)}
            type="button"
            role="menuitemradio"
            aria-checked={enabled === isEnabled}
            onClick={() => onChange(enabled)}
          >
            {t(enabled ? 'settings.enabled' : 'settings.disabled')}
          </button>
        ))}
      </div>
    </div>
  );
}
