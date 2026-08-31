// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { THEME_STORAGE_KEY } from '../theme';
import {
  NSFW_MODE_STORAGE_KEY,
  NsfwPreferencesProvider,
} from '../state/NsfwPreferencesProvider';
import { SettingsMenu } from './SettingsMenu';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  document.documentElement.style.colorScheme = '';
  vi.unstubAllGlobals();
});

describe('SettingsMenu', () => {
  it('blurs NSFW by default and persists the hide mode', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'light';
    render(
      <NsfwPreferencesProvider>
        <SettingsMenu />
      </NsfwPreferencesProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('menuitemradio', { name: 'Blur' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Hide' }));

    expect(screen.getByRole('menuitemradio', { name: 'Hide' }).getAttribute('aria-checked')).toBe('true');
    expect(storage.get(NSFW_MODE_STORAGE_KEY)).toBe('hide');
  });

  it('moves the Reader view switch into Settings', () => {
    const onReaderModeChange = vi.fn();
    document.documentElement.dataset.theme = 'light';
    render(<SettingsMenu readerMode="review" onReaderModeChange={onReaderModeChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('menuitemradio', { name: 'Review' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Scroll' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Scroll' }));

    expect(onReaderModeChange).toHaveBeenCalledWith('scroll');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers the Reader item order in Settings', () => {
    const onItemOrderChange = vi.fn();
    document.documentElement.dataset.theme = 'light';
    render(<SettingsMenu itemOrder="desc" onItemOrderChange={onItemOrderChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('menuitemradio', { name: 'Newest first' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Oldest first' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Oldest first' }));

    expect(onItemOrderChange).toHaveBeenCalledWith('asc');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers all four color themes in its appearance menu', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<SettingsMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(
      screen.getAllByRole('menuitemradio')
        .filter((option) => option.hasAttribute('data-theme-option'))
        .map((option) => option.getAttribute('aria-label')),
    )
      .toEqual([
        'System theme',
        'System Catppuccin theme',
        'Light theme',
        'Dark theme',
        'Catppuccin Latte theme',
        'Catppuccin Mocha theme',
      ]);
  });

  it('applies and persists the selected theme', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'dark';
    render(<SettingsMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Catppuccin Mocha theme' }));

    expect(document.documentElement.dataset.theme).toBe('mocha');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('mocha');
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('starts with a previously initialized theme', () => {
    document.documentElement.dataset.theme = 'latte';
    render(<SettingsMenu />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('follows live system color-scheme changes when System is selected', () => {
    let systemThemeChanged: (() => void) | undefined;
    const systemTheme = {
      matches: false,
      addEventListener: (_event: string, listener: () => void) => { systemThemeChanged = listener; },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => systemTheme);
    document.documentElement.dataset.themePreference = 'system';
    document.documentElement.dataset.theme = 'dark';
    render(<SettingsMenu />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    systemTheme.matches = true;
    systemThemeChanged?.();

    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('maps live system changes to Latte and Mocha in System Catppuccin mode', () => {
    let systemThemeChanged: (() => void) | undefined;
    const systemTheme = {
      matches: false,
      addEventListener: (_event: string, listener: () => void) => { systemThemeChanged = listener; },
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => systemTheme);
    document.documentElement.dataset.themePreference = 'system-catppuccin';
    document.documentElement.dataset.theme = 'mocha';
    render(<SettingsMenu />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    systemTheme.matches = true;
    systemThemeChanged?.();
    expect(document.documentElement.dataset.theme).toBe('latte');

    systemTheme.matches = false;
    systemThemeChanged?.();
    expect(document.documentElement.dataset.theme).toBe('mocha');
  });

  it('closes the menu with Escape and returns focus to the trigger', () => {
    document.documentElement.dataset.theme = 'light';
    render(<SettingsMenu />);
    const trigger = screen.getByRole('button', { name: 'Settings' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the settings menu relationship and expanded state accessible', () => {
    document.documentElement.dataset.theme = 'light';
    render(<SettingsMenu />);
    const trigger = screen.getByRole('button', { name: 'Settings' });

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBeTruthy();

    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: 'Settings menu' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(screen.getAllByRole('menuitemradio').every((item) => (
      item.getAttribute('aria-checked') === 'true' || item.getAttribute('aria-checked') === 'false'
    ))).toBe(true);

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
