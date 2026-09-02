import { useEffect, useMemo, useRef } from 'react';

import { abortPrefetches, prefetchFeedItem } from '../services/previewPrefetch';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';

export const REVIEW_PREVIEW_PREFETCH_COUNT = 3;

export function useReviewPreviewPrefetch({
  enabled,
  items,
  activeReviewIds,
}: {
  enabled: boolean;
  items: FeedItem[];
  activeReviewIds: number[];
}): void {
  const { preview: previewUseCases } = useFeatureUseCases();
  const { nsfwMode } = useNsfwPreferences();
  const prefetchedImageUrlsRef = useRef<Set<string>>(new Set());
  const prefetchControllersRef = useRef<Map<string, AbortController>>(new Map());
  const nextItems = useMemo(() => {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    return activeReviewIds
      .slice(1, REVIEW_PREVIEW_PREFETCH_COUNT + 1)
      .flatMap((itemId) => {
        const item = itemsById.get(itemId);
        return item ? [item] : [];
      });
  }, [activeReviewIds, items]);

  useEffect(() => {
    if (!enabled) {
      abortPrefetches(prefetchControllersRef.current);
      return undefined;
    }
    if (nextItems.length === 0) return undefined;

    // Let the current card enqueue its request first. The shared preview queue
    // then keeps prefetches bounded without delaying the item on screen.
    const timeoutId = window.setTimeout(() => {
      nextItems.forEach((item) => {
        prefetchFeedItem(
          item,
          previewUseCases,
          prefetchedImageUrlsRef.current,
          prefetchControllersRef.current,
          nsfwMode,
        );
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, nextItems, nsfwMode, previewUseCases]);

  useEffect(() => () => {
    abortPrefetches(prefetchControllersRef.current);
  }, []);
}
