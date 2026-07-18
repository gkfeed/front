// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { THEME_STORAGE_KEY } from '../theme';
import { ThemePicker } from './ThemePicker';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = '';
});

describe('ThemePicker', () => {
  it('offers all four color themes in its appearance menu', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Color theme: Dark' }));

    expect(screen.getAllByRole('menuitemradio').map((option) => option.getAttribute('aria-label')))
      .toEqual(['Light theme', 'Dark theme', 'Catppuccin Latte theme', 'Catppuccin Mocha theme']);
  });

  it('applies and persists the selected theme', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'dark';
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole('button', { name: 'Color theme: Dark' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Catppuccin Mocha theme' }));

    expect(document.documentElement.dataset.theme).toBe('mocha');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('mocha');
    expect(screen.getByRole('button', { name: 'Color theme: Mocha' })).toBeTruthy();
  });

  it('starts with a previously initialized theme', () => {
    document.documentElement.dataset.theme = 'latte';
    render(<ThemePicker />);

    expect(screen.getByRole('button', { name: 'Color theme: Latte' })).toBeTruthy();
  });

  it('closes the menu with Escape and returns focus to the trigger', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemePicker />);
    const trigger = screen.getByRole('button', { name: 'Color theme: Light' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
