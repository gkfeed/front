import { useEffect, useId, useRef, useState } from 'react';

import {
  applyTheme,
  getInitialThemePreference,
  isSystemPreference,
  saveTheme,
  themePreferences,
  type ThemePreference,
} from '../theme';

const shortLabels: Record<ThemePreference, string> = {
  system: 'System',
  'system-catppuccin': 'Catppuccin',
  light: 'Light',
  dark: 'Dark',
  latte: 'Latte',
  mocha: 'Mocha',
};

const descriptions: Record<ThemePreference, string> = {
  system: 'Light / Dark',
  'system-catppuccin': 'Latte / Mocha',
  light: 'Clean neutral',
  dark: 'GKFEED original',
  latte: 'Warm pastel',
  mocha: 'Deep pastel',
};

export function ThemePicker() {
  const [theme, setTheme] = useState(getInitialThemePreference);
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isSystemPreference(theme)) return;

    const systemTheme = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!systemTheme) return;
    const syncTheme = () => {
      if (theme === 'system-catppuccin') {
        applyTheme(systemTheme.matches ? 'latte' : 'mocha');
      } else {
        applyTheme(systemTheme.matches ? 'light' : 'dark');
      }
    };
    syncTheme();
    systemTheme.addEventListener('change', syncTheme);
    return () => systemTheme.removeEventListener('change', syncTheme);
  }, [theme]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        pickerRef.current?.querySelector<HTMLButtonElement>('.theme-picker__trigger')?.focus();
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="theme-picker" ref={pickerRef}>
      <button
        className="theme-picker__trigger"
        type="button"
        aria-label={`Color theme: ${shortLabels[theme]}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ThemeSwatch theme={theme} />
        <span>{shortLabels[theme]}</span>
        <span className="theme-picker__chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
        <div className="theme-picker__panel" id={panelId} role="menu" aria-label="Choose color theme">
          <div className="theme-picker__heading">
            <strong>Appearance</strong>
            <span>Choose your palette</span>
          </div>
          <div className="theme-picker__options">
            {themePreferences.map((option) => {
              const selected = option.value === theme;
              return (
                <button
                  className="theme-picker__option"
                  data-theme-option={option.value}
                  data-selected={selected || undefined}
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={`${option.label} theme`}
                  onClick={() => {
                    setTheme(option.value);
                    saveTheme(option.value);
                    setIsOpen(false);
                  }}
                >
                  <ThemeSwatch theme={option.value} />
                  <span className="theme-picker__option-copy">
                    <strong>{shortLabels[option.value]}</strong>
                    <small>{descriptions[option.value]}</small>
                  </span>
                  <span className="theme-picker__check" aria-hidden="true">✓</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: ThemePreference }) {
  return <span className="theme-swatch" data-theme-swatch={theme} aria-hidden="true"><span /></span>;
}
