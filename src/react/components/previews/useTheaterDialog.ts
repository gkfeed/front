import { useEffect } from 'react';
import type { RefObject } from 'react';

import { sendPlayerCommand } from './useYoutubePlayerController';

export function useTheaterDialog({
  isOpen,
  isPlayingRef,
  onOpenChange,
  onPlaybackChange,
  playerRef,
  triggerRef,
}: {
  isOpen: boolean;
  isPlayingRef: RefObject<boolean>;
  onOpenChange: (isOpen: boolean) => void;
  onPlaybackChange: (isPlaying: boolean) => void;
  playerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add('reader-theater-open');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === ' ' || event.code === 'Space') {
        const iframe = playerRef.current?.querySelector<HTMLIFrameElement>('iframe') ?? null;
        if (document.activeElement === iframe) return;
        event.preventDefault();
        const nextIsPlaying = !isPlayingRef.current;
        onPlaybackChange(nextIsPlaying);
        sendPlayerCommand(iframe, nextIsPlaying ? 'playVideo' : 'pauseVideo');
        return;
      }
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
    playerElement?.querySelector<HTMLIFrameElement>('iframe')?.focus();
    return () => {
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
      if (playerElement?.contains(document.activeElement)) {
        playerElement.querySelector<HTMLButtonElement>('button')?.focus();
      } else {
        triggerElement?.focus();
      }
    };
  }, [isOpen, isPlayingRef, onOpenChange, onPlaybackChange, playerRef, triggerRef]);
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, iframe, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}
