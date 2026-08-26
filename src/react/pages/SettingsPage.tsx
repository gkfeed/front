import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../styles/settings.css';
import { NsfwPicker } from '../components/NsfwPicker';
import { ReaderModePicker } from '../components/ReaderModePicker';
import { ThemeOptions } from '../components/ThemeOptions';
import { TikTokPreviewModePicker } from '../components/TikTokPreviewModePicker';
import { useThemePreference } from '../components/useThemePreference';
import {
  readReaderModePreference,
  saveReaderModePreference,
  type ReaderMode,
} from '../state/readerMode';

export function SettingsPage() {
  const { t } = useTranslation();
  const { theme, selectTheme } = useThemePreference();
  const [readerMode, setReaderMode] = useState(readReaderModePreference);

  function selectReaderMode(mode: ReaderMode) {
    setReaderMode(mode);
    saveReaderModePreference(mode);
  }

  return (
    <section className="settings-page" aria-labelledby="settings-page-title">
      <header className="settings-page__header">
        <span className="settings-page__eyebrow">GKFEED</span>
        <h1 id="settings-page-title">{t('settings.heading')}</h1>
        <p>{t('settings.pageDescription')}</p>
      </header>

      <div className="settings-page__layout">
        <section className="settings-page__card" aria-labelledby="settings-playback-title">
          <div className="settings-page__card-heading">
            <span className="settings-page__card-icon" aria-hidden="true">▶</span>
            <div>
              <h2 id="settings-playback-title">{t('settings.playback')}</h2>
              <p>{t('settings.playbackDescription')}</p>
            </div>
          </div>
          <TikTokPreviewModePicker />
          <ReaderModePicker
            readerMode={readerMode}
            onReaderModeChange={selectReaderMode}
            itemRole="radio"
          />
        </section>

        <section className="settings-page__card" aria-labelledby="settings-content-title">
          <div className="settings-page__card-heading">
            <span className="settings-page__card-icon" aria-hidden="true">◫</span>
            <div>
              <h2 id="settings-content-title">{t('settings.content')}</h2>
              <p>{t('settings.contentDescription')}</p>
            </div>
          </div>
          <NsfwPicker itemRole="radio" />
        </section>

        <section className="settings-page__card settings-page__card--appearance" aria-labelledby="settings-appearance-title">
          <div className="settings-page__card-heading">
            <span className="settings-page__card-icon" aria-hidden="true">✦</span>
            <div>
              <h2 id="settings-appearance-title">{t('settings.appearance')}</h2>
              <p>{t('settings.appearanceDescription')}</p>
            </div>
          </div>
          <ThemeOptions
            theme={theme}
            onThemeChange={selectTheme}
            itemRole="radio"
          />
        </section>
      </div>
    </section>
  );
}

export default SettingsPage;
