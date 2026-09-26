// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
  FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
  FeedPriorityProvider,
  MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
} from '../state/FeedPriorityProvider';
import { NsfwPreferencesProvider } from '../state/NsfwPreferencesProvider';
import {
  DISABLED_PLUGINS_STORAGE_KEY,
  PluginPreferencesProvider,
} from '../state/PluginPreferencesProvider';
import { ReaderItemOrderPreferencesProvider } from '../state/ReaderItemOrderPreferencesProvider';
import { TikTokPreferencesProvider } from '../state/TikTokPreferencesProvider';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { SettingsPage } from './SettingsPage';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
});

describe('SettingsPage', () => {
  it('renders every built-in plugin and persists a disabled integration', () => {
    const storage = stubLocalStorage();
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(13);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Twitch' }));

    expect(JSON.parse(storage.get(DISABLED_PLUGINS_STORAGE_KEY)!)).toEqual(['twitch']);
    expect(screen.getByRole('button', { name: 'Enable all' })).toBeTruthy();
  });

  it('persists manual and automatic feed prioritization separately', () => {
    const storage = stubLocalStorage();
    renderSettings();
    const manual = within(screen.getByRole('radiogroup', { name: 'Manual prioritization' }));
    const automatic = within(screen.getByRole('radiogroup', { name: 'Automatic prioritization' }));

    fireEvent.click(manual.getByRole('radio', { name: 'Disabled' }));
    expect(storage.get(MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY)).toBe('false');
    expect(automatic.getByRole('radio', { name: 'Enabled' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(automatic.getByRole('radio', { name: 'Disabled' }));
    expect(storage.get(AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY)).toBe('false');
  });

  it('uses the former shared prioritization preference as a fallback', () => {
    const storage = stubLocalStorage();
    storage.set(FEED_PRIORITIZATION_ENABLED_STORAGE_KEY, 'false');
    renderSettings();

    for (const name of ['Manual prioritization', 'Automatic prioritization']) {
      expect(within(screen.getByRole('radiogroup', { name }))
        .getByRole('radio', { name: 'Disabled' })
        .getAttribute('aria-checked')).toBe('true');
    }
  });
});

function renderSettings() {
  return render(
    <FeedPriorityProvider>
      <NsfwPreferencesProvider>
        <PluginPreferencesProvider>
          <TikTokPreferencesProvider>
            <ReaderItemOrderPreferencesProvider>
              <SettingsPage />
            </ReaderItemOrderPreferencesProvider>
          </TikTokPreferencesProvider>
        </PluginPreferencesProvider>
      </NsfwPreferencesProvider>
    </FeedPriorityProvider>,
  );
}
