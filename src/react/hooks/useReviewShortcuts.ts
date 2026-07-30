import { useEffect } from 'react';

import type { ReaderMode } from '../state/readerMode';
import type { FeedItem } from '../types';

type ReviewShortcutsOptions = {
  mode: ReaderMode;
  currentItem: FeedItem | undefined;
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
};

export function useReviewShortcuts({
  mode,
  currentItem,
  isDeleting,
  onKeep,
  onDelete,
}: ReviewShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        mode !== 'review'
        || !currentItem
        || isDeleting
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || isTextEntryTarget(event.target)
        || (event.target instanceof Element && event.target.closest('[role="tab"]'))
      ) {
        return;
      }

      if (event.key === 'a') {
        event.preventDefault();
        onKeep();
      } else if (event.key === 'd') {
        event.preventDefault();
        void onDelete();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, isDeleting, mode, onDelete, onKeep]);
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}
