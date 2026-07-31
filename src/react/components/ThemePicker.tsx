import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

const themeLabelKeys: Record<ThemePreference, string> = {
  system: 'settings.themeSystem',
  'system-catppuccin': 'settings.themeSystemCatppuccin',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
  latte: 'settings.themeLatte',
  mocha: 'settings.themeMocha',
};

const themeDescriptionKeys: Record<ThemePreference, string> = {
  system: 'settings.descriptionSystem',
  'system-catppuccin': 'settings.descriptionSystemCatppuccin',
  light: 'settings.descriptionLight',
  dark: 'settings.descriptionDark',
  latte: 'settings.descriptionLatte',
  mocha: 'settings.descriptionMocha',
};

const themeAriaLabelKeys: Record<ThemePreference, string> = {
  system: 'settings.themeSystemAria',
  'system-catppuccin': 'settings.themeSystemCatppuccinAria',
  light: 'settings.themeLightAria',
  dark: 'settings.themeDarkAria',
  latte: 'settings.themeLatteAria',
  mocha: 'settings.themeMochaAria',
};

type ThemePickerProps = {
  readerMode?: ReaderMode;
  onReaderModeChange?: (mode: ReaderMode) => void;
};

export function ThemePicker({ readerMode, onReaderModeChange }: ThemePickerProps) {
  const { t } = useTranslation();
  const { nsfwMode, setNsfwMode } = useNsfwPreferences();
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
        aria-label={t('settings.button')}
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
        <div className="theme-picker__panel" id={panelId} role="menu" aria-label={t('settings.menu')}>
          <div className="theme-picker__heading">
            <strong>{t('settings.heading')}</strong>
            <span>{t('settings.description')}</span>
          </div>
          {readerMode && onReaderModeChange ? (
            <div className="theme-picker__section">
              <span className="theme-picker__section-title">{t('settings.readerView')}</span>
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
                      {mode === 'review' ? t('settings.review') : t('settings.scroll')}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="theme-picker__section">
            <span className="theme-picker__section-title">{t('settings.content')}</span>
            <span className="theme-picker__content-description">{t('settings.nsfwDescription')}</span>
            <div className="theme-picker__nsfw-options">
              {([
                { mode: 'show', labelKey: 'settings.show', icon: '○' },
                { mode: 'blur', labelKey: 'settings.blur', icon: '◉' },
                { mode: 'hide', labelKey: 'settings.hide', icon: '⊘' },
              ] as const).map((option) => {
                const selected = option.mode === nsfwMode;
                return (
                  <button
                    className="theme-picker__nsfw-option"
                    data-selected={selected || undefined}
                    key={option.mode}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => setNsfwMode(option.mode)}
                  >
                    <span aria-hidden="true">{option.icon}</span>
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="theme-picker__section">
            <span className="theme-picker__section-title">{t('settings.appearance')}</span>
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
                  aria-label={t('settings.theme', { theme: t(themeAriaLabelKeys[option.value]) })}
                  onClick={() => {
                    setTheme(option.value);
                    saveTheme(option.value);
                    setIsOpen(false);
                  }}
                >
                  <ThemeSwatch theme={option.value} />
                  <span className="theme-picker__option-copy">
                    <strong>{t(themeLabelKeys[option.value])}</strong>
                    <small>{t(themeDescriptionKeys[option.value])}</small>
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
