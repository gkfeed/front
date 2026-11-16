import { useEffect } from 'react';
import { readerDiagnostic } from '../services/readerDiagnostics';

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
        || document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')
        || isTextEntryTarget(event.target)
        || (event.target instanceof Element && event.target.closest('[role="tab"]'))
      ) {
        return;
      }

      if (event.key === 'a') {
        if (import.meta.env.DEV) readerDiagnostic('decision-key', currentItem.id, `keep:dispatch-delay-ms=${Math.max(0, Math.round(performance.now() - event.timeStamp))}`);
        event.preventDefault();
        onKeep();
      } else if (event.key === 'd') {
        if (import.meta.env.DEV) readerDiagnostic('decision-key', currentItem.id, `delete:dispatch-delay-ms=${Math.max(0, Math.round(performance.now() - event.timeStamp))}`);
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
