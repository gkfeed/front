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
  it('offers all four color themes', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemePicker />);

    const labels = screen.getAllByRole('option').map((option) => option.textContent);
    expect(labels).toEqual(['Light', 'Dark', 'Catppuccin Latte', 'Catppuccin Mocha']);
  });

  it('applies and persists the selected theme', () => {
    const storage = stubLocalStorage();
    document.documentElement.dataset.theme = 'dark';
    render(<ThemePicker />);

    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'mocha' } });

    expect(document.documentElement.dataset.theme).toBe('mocha');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(storage.get(THEME_STORAGE_KEY)).toBe('mocha');
  });

  it('starts with a previously initialized theme', () => {
    document.documentElement.dataset.theme = 'latte';
    render(<ThemePicker />);

    expect((screen.getByLabelText('Color theme') as HTMLSelectElement).value).toBe('latte');
  });
});
