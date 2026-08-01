import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { ReaderMode } from '../state/readerMode';
import type { FeedItem } from '../types';

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

      const cardBottom = card!.getBoundingClientRect().bottom + window.scrollY;
      const panelGap = Number.parseFloat(window.getComputedStyle(panel!).rowGap) || 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const actionsBottom = cardBottom + panelGap + actionsHeightRef.current;
      const viewportBottom = window.scrollY + viewportHeight;
      setCompactActionsItemId(actionsBottom > viewportBottom ? itemId : null);
    }

    updateActionsLayout();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateActionsLayout);
    resizeObserver?.observe(card);
    window.addEventListener('resize', updateActionsLayout);
    window.addEventListener('scroll', updateActionsLayout, { passive: true });
    window.visualViewport?.addEventListener('resize', updateActionsLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateActionsLayout);
      window.removeEventListener('scroll', updateActionsLayout);
      window.visualViewport?.removeEventListener('resize', updateActionsLayout);
    };
  }, [currentItem, mode]);

  return {
    panelRef,
    actionsRef,
    useCompactActions: mode === 'review' && currentItem?.id === compactActionsItemId,
  };
}
