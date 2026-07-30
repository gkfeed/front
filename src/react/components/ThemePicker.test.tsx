// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { THEME_STORAGE_KEY } from '../theme';
import {
  NSFW_BLUR_STORAGE_KEY,
  NsfwPreferencesProvider,
} from '../state/NsfwPreferencesProvider';
import { ThemePicker } from './ThemePicker';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  document.documentElement.style.colorScheme = '';
  vi.unstubAllGlobals();
});

describe('ThemePicker', () => {
  it('enables NSFW blurring by default and persists changes', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'light';
    render(
      <NsfwPreferencesProvider>
        <ThemePicker />
      </NsfwPreferencesProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const toggle = screen.getByRole('menuitemcheckbox', { name: /Blur NSFW/i });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(storage.get(NSFW_BLUR_STORAGE_KEY)).toBe('false');
  });

  it('moves the Reader view switch into Settings', () => {
    const onReaderModeChange = vi.fn();
    document.documentElement.dataset.theme = 'light';
    render(<ThemePicker readerMode="review" onReaderModeChange={onReaderModeChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('menuitemradio', { name: 'Review' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'Scroll' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Scroll' }));

    expect(onReaderModeChange).toHaveBeenCalledWith('scroll');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('offers all four color themes in its appearance menu', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getAllByRole('menuitemradio').map((option) => option.getAttribute('aria-label')))
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
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Catppuccin Mocha theme' }));

    expect(document.documentElement.dataset.theme).toBe('mocha');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('mocha');
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('starts with a previously initialized theme', () => {
    document.documentElement.dataset.theme = 'latte';
    render(<ThemePicker />);

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
    render(<ThemePicker />);

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
    render(<ThemePicker />);

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
    render(<ThemePicker />);
    const trigger = screen.getByRole('button', { name: 'Settings' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
