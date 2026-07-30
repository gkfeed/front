import { useEffect, useId, useRef, useState } from 'react';

import {
  applyTheme,
  getInitialThemePreference,
  isSystemPreference,
  saveTheme,
  themePreferences,
  type ThemePreference,
} from '../theme';
import type { ReaderMode } from '../state/readerMode';
import { useNsfwPreferences } from '../state/useNsfwPreferences';

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

type ThemePickerProps = {
  readerMode?: ReaderMode;
  onReaderModeChange?: (mode: ReaderMode) => void;
};

export function ThemePicker({ readerMode, onReaderModeChange }: ThemePickerProps) {
  const { blurNsfw, setBlurNsfw } = useNsfwPreferences();
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
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg className="theme-picker__gear" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.7 2.8h4.6l.7 2.5c.5.2 1 .5 1.5.9l2.5-.7 2.3 4-1.9 1.8v1.8l1.9 1.8-2.3 4-2.5-.7c-.5.4-1 .7-1.5.9l-.7 2.5H9.7L9 19.1c-.5-.2-1-.5-1.5-.9l-2.5.7-2.3-4 1.9-1.8v-1.8L2.7 9.5l2.3-4 2.5.7c.5-.4 1-.7 1.5-.9l.7-2.5Z" />
          <circle cx="12" cy="12.2" r="3.1" />
        </svg>
      </button>

      {isOpen ? (
        <div className="theme-picker__panel" id={panelId} role="menu" aria-label="Settings menu">
          <div className="theme-picker__heading">
            <strong>Settings</strong>
            <span>Preferences and appearance</span>
          </div>
          {readerMode && onReaderModeChange ? (
            <div className="theme-picker__section">
              <span className="theme-picker__section-title">Reader view</span>
              <div className="theme-picker__reader-options">
                {(['review', 'scroll'] as const).map((mode) => {
                  const selected = mode === readerMode;
                  return (
                    <button
                      className="theme-picker__reader-option"
                      data-selected={selected || undefined}
                      key={mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onReaderModeChange(mode);
                        setIsOpen(false);
                      }}
                    >
                      <span aria-hidden="true">{mode === 'review' ? '✓' : '↕'}</span>
                      {mode === 'review' ? 'Review' : 'Scroll'}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="theme-picker__section">
            <span className="theme-picker__section-title">Content</span>
            <button
              className="theme-picker__toggle"
              type="button"
              role="menuitemcheckbox"
              aria-checked={blurNsfw}
              onClick={() => setBlurNsfw(!blurNsfw)}
            >
              <span className="theme-picker__toggle-copy">
                <strong>Blur NSFW</strong>
                <small>Porno365 and Pornhub items</small>
              </span>
              <span className="theme-picker__switch" aria-hidden="true">
                <span />
              </span>
            </button>
          </div>
          <div className="theme-picker__section">
            <span className="theme-picker__section-title">Appearance</span>
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
        </div>
      ) : null}
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: ThemePreference }) {
  return <span className="theme-swatch" data-theme-swatch={theme} aria-hidden="true"><span /></span>;
}
