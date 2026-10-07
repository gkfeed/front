import { useTranslation } from 'react-i18next';
import { useTikTokPreferences } from '../state/useTikTokPreferences';

export function TikTokPlaybackPicker() {
  const { t } = useTranslation();
  const { playbackMode, setPlaybackMode } = useTikTokPreferences();
  return (
    <div className="settings-menu__section">
      <span className="settings-menu__section-title">{t('settings.tiktokPlayback')}</span>
      <span className="settings-menu__content-description">{t('settings.tiktokPlaybackDescription')}</span>
      <div className="settings-menu__tiktok-options" role="radiogroup" aria-label={t('settings.tiktokPlayback')}>
        {(['embed', 'preview'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className="settings-menu__tiktok-option"
            role="radio"
            aria-checked={playbackMode === mode}
            data-selected={playbackMode === mode || undefined}
            onClick={() => setPlaybackMode(mode)}
          >
            {t(mode === 'embed' ? 'settings.tiktokEmbed' : 'settings.tiktokPreview')}
          </button>
        ))}
      </div>
    </div>
  );
}
