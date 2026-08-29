import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  function closeMenu(focusTrigger = false) {
    setIsOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;

    panelRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu(true);
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
    <div className="settings-menu" ref={menuRef}>
      <button
        className="settings-menu__trigger"
        type="button"
        ref={triggerRef}
        aria-label={t('settings.button')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg className="settings-menu__gear" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.7 2.8h4.6l.7 2.5c.5.2 1 .5 1.5.9l2.5-.7 2.3 4-1.9 1.8v1.8l1.9 1.8-2.3 4-2.5-.7c-.5.4-1 .7-1.5.9l-.7 2.5H9.7L9 19.1c-.5-.2-1-.5-1.5-.9l-2.5.7-2.3-4 1.9-1.8v-1.8L2.7 9.5l2.3-4 2.5.7c.5-.4 1-.7 1.5-.9l.7-2.5Z" />
          <circle cx="12" cy="12.2" r="3.1" />
        </svg>
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className="settings-menu__panel"
          id={panelId}
          role="menu"
          aria-label={t('settings.menu')}
          onKeyDown={handleMenuKeyDown}
        >
          <div className="settings-menu__heading">
            <strong>{t('settings.heading')}</strong>
            <span>{t('settings.description')}</span>
          </div>
          {readerMode && onReaderModeChange ? (
            <ReaderModePicker
              readerMode={readerMode}
              onReaderModeChange={(mode) => {
                onReaderModeChange(mode);
                closeMenu(true);
              }}
            />
          ) : null}
          <NsfwPicker />
          <ThemeOptions
            theme={theme}
            onThemeChange={selectTheme}
            onSelect={() => closeMenu(true)}
          />
        </div>
      ) : null}
    </div>
  );
}

function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const menu = event.currentTarget;
  const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
  if (items.length === 0) return;
  const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? items.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  event.preventDefault();
  items[nextIndex]?.focus();
}
