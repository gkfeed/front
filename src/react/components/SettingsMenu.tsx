import { useTranslation } from 'react-i18next';

import '../../styles/settings-menu.css';

import type { ReaderMode } from '../state/readerMode';
import type { ReaderItemOrder } from '../state/readerItemOrder';
import { FeedPriorityPicker } from './FeedPriorityPicker';
import { NsfwPicker } from './NsfwPicker';
import { ReaderItemOrderPicker } from './ReaderItemOrderPicker';
import { ReaderModePicker } from './ReaderModePicker';
import { ThemeOptions } from './ThemeOptions';
import { TikTokPicker } from './TikTokPicker';
import { useThemePreference } from './useThemePreference';
import { useMenuController } from '../hooks/useMenuController';

export type SettingsMenuProps = {
  readerMode?: ReaderMode;
  onReaderModeChange?: (mode: ReaderMode) => void;
  itemOrder?: ReaderItemOrder;
  onItemOrderChange?: (order: ReaderItemOrder) => void;
};

export function SettingsMenu({
  readerMode,
  onReaderModeChange,
  itemOrder,
  onItemOrderChange,
}: SettingsMenuProps) {
  const { t } = useTranslation();
  const { theme, selectTheme } = useThemePreference();
  const {
    isOpen,
    menuRef,
    panelRef,
    triggerRef,
    panelId,
    closeMenu,
    toggleMenu,
    handleMenuKeyDown,
  } = useMenuController();

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
        onClick={toggleMenu}
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
          {itemOrder && onItemOrderChange ? (
            <ReaderItemOrderPicker
              itemOrder={itemOrder}
              onItemOrderChange={(order) => {
                onItemOrderChange(order);
                closeMenu(true);
              }}
            />
          ) : null}
          <FeedPriorityPicker />
          <NsfwPicker />
          <TikTokPicker />
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
