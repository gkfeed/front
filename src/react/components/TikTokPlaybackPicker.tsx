import { useTranslation } from 'react-i18next';
import { useTikTokPreferences } from '../state/useTikTokPreferences';

export function TikTokPlaybackPicker() {
  const { t } = useTranslation();
  const { playbackMode, setPlaybackMode } = useTikTokPreferences();
  return (
    <div className="settings-menu__section" role="group" aria-label={t('settings.tiktokPlayback')}>
      <span className="settings-menu__section-title">{t('settings.tiktokPlayback')}</span>
      <span className="settings-menu__content-description">{t('settings.tiktokPlaybackDescription')}</span>
      <div className="settings-menu__tiktok-options">
        {(['embed', 'preview'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className="settings-menu__tiktok-option"
            role="menuitemradio"
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
