import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ReaderMode } from '../state/readerMode';
import { NsfwPicker } from './NsfwPicker';
import { ReaderModePicker } from './ReaderModePicker';
import { ThemeOptions } from './ThemeOptions';
import { useThemePreference } from './useThemePreference';

export type SettingsMenuProps = {
  readerMode?: ReaderMode;
  onReaderModeChange?: (mode: ReaderMode) => void;
};

export function SettingsMenu({ readerMode, onReaderModeChange }: SettingsMenuProps) {
  const { t } = useTranslation();
  const { theme, selectTheme } = useThemePreference();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        menuRef.current?.querySelector<HTMLButtonElement>('.theme-picker__trigger')?.focus();
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
    <div className="theme-picker" ref={menuRef}>
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
            <ReaderModePicker
              readerMode={readerMode}
              onReaderModeChange={(mode) => {
                onReaderModeChange(mode);
                setIsOpen(false);
              }}
            />
          ) : null}
          <NsfwPicker />
          <ThemeOptions
            theme={theme}
            onThemeChange={selectTheme}
            onSelect={() => setIsOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
