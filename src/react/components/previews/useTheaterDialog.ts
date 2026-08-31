import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { trapFocus } from '../../platform/focusTrap';

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
      trapFocus(event, playerRef.current, { fallback: null, visibleOnly: true });
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
