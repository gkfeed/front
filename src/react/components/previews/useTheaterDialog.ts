import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useTheaterDialog({
  initialFocusSelector = 'iframe',
  isOpen,
  onKeyDown,
  onOpenChange,
  playerRef,
  triggerRef,
}: {
  initialFocusSelector?: string;
  isOpen: boolean;
  onKeyDown?: (event: KeyboardEvent) => boolean;
  onOpenChange: (isOpen: boolean) => void;
  playerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const onKeyDownRef = useRef(onKeyDown);
  const onOpenChangeRef = useRef(onOpenChange);
  onKeyDownRef.current = onKeyDown;
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add('reader-theater-open');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (onKeyDownRef.current?.(event)) return;
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(playerRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const playerElement = playerRef.current;
    const triggerElement = triggerRef.current;
    window.addEventListener('keydown', handleKeyDown);
    playerElement?.querySelector<HTMLElement>(initialFocusSelector)?.focus();
    return () => {
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
      if (playerElement?.contains(document.activeElement)) {
        playerElement.querySelector<HTMLButtonElement>('button')?.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [initialFocusSelector, isOpen, playerRef, triggerRef]);
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, iframe, video, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
