import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export function useMenuController() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const closeMenu = useCallback((focusTrigger = false) => {
    setIsOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  const toggleMenu = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    panelRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus();

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeMenu, isOpen]);

  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
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
  }, []);

  return {
    isOpen,
    menuRef,
    panelRef,
    triggerRef,
    panelId,
    closeMenu,
    toggleMenu,
    handleMenuKeyDown,
  };
}
