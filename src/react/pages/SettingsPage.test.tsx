// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  NSFW_MODE_STORAGE_KEY,
  NsfwPreferencesProvider,
} from '../state/NsfwPreferencesProvider';
import { TikTokPreviewPreferencesProvider } from '../state/TikTokPreviewPreferencesProvider';
import {
  TIKTOK_PREVIEW_MODE_STORAGE_KEY,
} from '../state/tiktokPreviewPreferences';
import { READER_MODE_STORAGE_KEY } from '../state/readerMode';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { THEME_STORAGE_KEY } from '../theme';
import { SettingsPage } from './SettingsPage';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  document.documentElement.style.colorScheme = '';
});

describe('SettingsPage', () => {
  it('renders preferences as a page and persists playback choices', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'light';

    render(
      <NsfwPreferencesProvider>
        <TikTokPreviewPreferencesProvider>
          <SettingsPage />
        </TikTokPreviewPreferencesProvider>
      </NsfwPreferencesProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('radio', { name: /TikTok embed/ }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: /Download through broker/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Scroll' }));

    expect(storage.get(TIKTOK_PREVIEW_MODE_STORAGE_KEY)).toBe('broker');
    expect(storage.get(READER_MODE_STORAGE_KEY)).toBe('scroll');
  });

  it('persists content and appearance preferences from the page', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'light';

    render(
      <NsfwPreferencesProvider>
        <TikTokPreviewPreferencesProvider>
          <SettingsPage />
        </TikTokPreviewPreferencesProvider>
      </NsfwPreferencesProvider>,
    );

    expect(screen.getByRole('radio', { name: 'Blur' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Hide' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Catppuccin Mocha theme' }));

    expect(storage.get(NSFW_MODE_STORAGE_KEY)).toBe('hide');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('mocha');
    expect(document.documentElement.dataset.theme).toBe('mocha');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
