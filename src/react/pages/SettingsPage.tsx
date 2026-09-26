import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../styles/settings-page.css';

import { FeedPriorityPicker } from '../components/FeedPriorityPicker';
import { NsfwPicker } from '../components/NsfwPicker';
import { ReaderItemOrderPicker } from '../components/ReaderItemOrderPicker';
import { ReaderModePicker } from '../components/ReaderModePicker';
import { ThemeOptions } from '../components/ThemeOptions';
import { TikTokPicker } from '../components/TikTokPicker';
import { TikTokPlaybackPicker } from '../components/TikTokPlaybackPicker';
import { feedPluginCatalog } from '../domain/feedItemProviderPresentation';
import {
  readDefaultReaderMode,
  setDefaultReaderMode,
  type ReaderMode,
} from '../state/readerMode';
import { usePluginPreferences } from '../state/usePluginPreferences';
import { useReaderItemOrderPreferences } from '../state/useReaderItemOrderPreferences';
import { useThemePreference } from '../components/useThemePreference';

export function SettingsPage() {
  const { t } = useTranslation();
  const [readerMode, setReaderMode] = useState(readDefaultReaderMode);
  const { itemOrder, setItemOrder } = useReaderItemOrderPreferences();
  const { theme, selectTheme } = useThemePreference();

  const updateReaderMode = (mode: ReaderMode) => {
    setReaderMode(mode);
    setDefaultReaderMode(mode);
  };

  return (
    <section className="settings-page" aria-labelledby="settings-page-title">
      <header className="settings-page__header">
        <h1 id="settings-page-title">{t('pages.settings')}</h1>
        <p>{t('settings.description')}</p>
      </header>

      <SettingsSection title={t('settings.general')}>
        <FeedPriorityPicker />
      </SettingsSection>
      <SettingsSection title={t('settings.reader')}>
        <ReaderModePicker readerMode={readerMode} onReaderModeChange={updateReaderMode} />
        <ReaderItemOrderPicker itemOrder={itemOrder} onItemOrderChange={setItemOrder} />
      </SettingsSection>
      <SettingsSection title={t('settings.content')}>
        <NsfwPicker />
      </SettingsSection>
      <SettingsSection title={t('settings.plugins')}>
        <PluginSettings />
      </SettingsSection>
      <SettingsSection title={t('settings.appearance')}>
        <ThemeOptions theme={theme} onThemeChange={selectTheme} onSelect={() => {}} />
      </SettingsSection>
    </section>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-page__section">
      <h2>{title}</h2>
      <div className="settings-page__section-content">{children}</div>
    </section>
  );
}

function PluginSettings() {
  const { t } = useTranslation();
  const {
    disabledPlugins,
    isPluginEnabled,
    setPluginEnabled,
    enableAllPlugins,
  } = usePluginPreferences();
  const plugins = [...feedPluginCatalog].sort((left, right) => left.title.localeCompare(right.title));

  return (
    <div className="plugin-settings">
      {disabledPlugins.size > 0 ? (
        <button className="ui-button--secondary plugin-settings__enable-all" type="button" onClick={enableAllPlugins}>
          {t('settings.enableAllPlugins')}
        </button>
      ) : null}
      <div className="plugin-settings__list">
        {plugins.map((plugin) => {
          const enabled = isPluginEnabled(plugin.id);
          return (
            <div className="plugin-settings__item" key={plugin.id}>
              <label className="plugin-settings__toggle">
                <span>{plugin.title}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setPluginEnabled(plugin.id, event.target.checked)}
                />
              </label>
              {plugin.id === 'tiktok' ? (
                <fieldset className="plugin-settings__nested" disabled={!enabled}>
                  <TikTokPicker />
                  <TikTokPlaybackPicker />
                </fieldset>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
