import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ReaderMode } from '../state/readerMode';
import type { FeedItem } from '../types';

const READER_FULLSCREEN_CHANGE_EVENT = 'readerfullscreenchange';

export function useReviewActionsLayout(
  mode: ReaderMode,
  currentItem: FeedItem | undefined,
): {
  panelRef: RefObject<HTMLDivElement | null>;
  actionsRef: RefObject<HTMLDivElement | null>;
  useCompactActions: boolean;
} {
  const [compactActionsItemId, setCompactActionsItemId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const actionsHeightRef = useRef(52);

  useLayoutEffect(() => {
    if (mode !== 'review' || !currentItem) {
      setCompactActionsItemId(null);
      return;
    }

    const itemId = currentItem.id;
    const panel = panelRef.current;
    const card = panel?.querySelector<HTMLElement>(':scope > .reader-card');
    if (!panel || !card) return;

    function updateActionsLayout() {
      const actions = actionsRef.current;
      if (actions && actions.offsetHeight > 0) {
        actionsHeightRef.current = actions.offsetHeight;
      }

      const cardBottom = card!.getBoundingClientRect().bottom;
      const panelGap = Number.parseFloat(window.getComputedStyle(panel!).rowGap) || 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const actionsBottom = cardBottom + panelGap + actionsHeightRef.current;
      setCompactActionsItemId(actionsBottom > viewportHeight ? itemId : null);
    }

    updateActionsLayout();

    const main = panel.closest<HTMLElement>('main');
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateActionsLayout);
    resizeObserver?.observe(card);
    window.addEventListener('resize', updateActionsLayout);
    window.addEventListener('scroll', updateActionsLayout, { passive: true });
    main?.addEventListener('scroll', updateActionsLayout, { passive: true });
    document.addEventListener('fullscreenchange', updateActionsLayout);
    document.addEventListener('webkitfullscreenchange', updateActionsLayout);
    document.addEventListener(READER_FULLSCREEN_CHANGE_EVENT, updateActionsLayout);
    window.visualViewport?.addEventListener('resize', updateActionsLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateActionsLayout);
      window.removeEventListener('scroll', updateActionsLayout);
      main?.removeEventListener('scroll', updateActionsLayout);
      document.removeEventListener('fullscreenchange', updateActionsLayout);
      document.removeEventListener('webkitfullscreenchange', updateActionsLayout);
      document.removeEventListener(READER_FULLSCREEN_CHANGE_EVENT, updateActionsLayout);
      window.visualViewport?.removeEventListener('resize', updateActionsLayout);
    };
  }, [currentItem, mode]);

  return {
    panelRef,
    actionsRef,
    useCompactActions: mode === 'review' && currentItem?.id === compactActionsItemId,
  };
}
