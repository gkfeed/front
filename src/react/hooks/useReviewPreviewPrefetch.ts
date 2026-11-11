import { useEffect, useMemo, useRef } from 'react';

import { abortPrefetches, prefetchFeedItem } from '../services/previewPrefetch';
import { prefetchStoryVideo } from '../services/storyVideoPrefetch';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';
import { usePluginPreferences } from '../state/usePluginPreferences';

export const REVIEW_PREVIEW_PREFETCH_COUNT = 10;

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
  const { disabledPlugins } = usePluginPreferences();
  const prefetchedImageUrlsRef = useRef<Set<string>>(new Set());
  const prefetchControllersRef = useRef<Map<string, AbortController>>(new Map());
  // Navigation may retain overlapping work, but a policy change invalidates it.
  useEffect(() => {
    const controllers = prefetchControllersRef.current;
    return () => abortPrefetches(controllers);
  }, [disabledPlugins, nsfwMode, previewUseCases]);
  const nextItems = useMemo(() => {
    const itemsById = new Map(items.map((item) => [item.id, item]));
    return activeReviewIds
      .slice(1, REVIEW_PREVIEW_PREFETCH_COUNT + 1)
      .flatMap((itemId) => {
        const item = itemsById.get(itemId);
        return item ? [item] : [];
      });
  }, [activeReviewIds, items]);
  const nextItem = nextItems[0];

  useEffect(() => {
    if (!enabled || !nextItem) return;
    // Start after the visible card has had a chance to request its media.
    let dispose: (() => void) | undefined;
    const timeoutId = window.setTimeout(() => {
      dispose = prefetchStoryVideo(nextItem, previewUseCases, nsfwMode);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      dispose?.();
    };
  }, [enabled, nextItem, nsfwMode, previewUseCases]);

  useEffect(() => {
    if (!enabled) {
      abortPrefetches(prefetchControllersRef.current);
      return undefined;
    }
    const retainedIds = new Set(activeReviewIds.slice(0, REVIEW_PREVIEW_PREFETCH_COUNT + 1));
    const retainedKeys = new Set(items.filter((item) => retainedIds.has(item.id)).flatMap((item) => [
      `open-graph:${item.link}`,
      `liquipedia:${item.link}`,
    ]));
    // Keep a small amount of work displaced by a reorder. Drop the oldest
    // displaced requests first, and release everything when the queue ends.
    const displaced = [...prefetchControllersRef.current].filter(([key]) => !retainedKeys.has(key));
    for (const [key] of displaced) {
      const separator = key.indexOf(':');
      const source = key.slice(0, separator);
      if (source === 'open-graph' || source === 'liquipedia') {
        previewUseCases.reprioritizeRemotePreview?.(key.slice(separator + 1), source, 100);
      }
    }
    const spare = activeReviewIds.length > 0 ? 3 : 0;
    for (const [key, controller] of displaced.slice(0, Math.max(0, displaced.length - spare))) {
      controller.abort();
      prefetchControllersRef.current.delete(key);
    }
    // Give short-lived reorders time to settle, then release spare requests so
    // they cannot monopolize the network slots needed by the new window.
    const releaseId = window.setTimeout(() => {
      for (const [key, controller] of displaced) {
        if (prefetchControllersRef.current.get(key) !== controller) continue;
        controller.abort();
        prefetchControllersRef.current.delete(key);
      }
    }, 50);
    if (nextItems.length === 0) return () => window.clearTimeout(releaseId);

    // Let the current card enqueue its request first. The shared preview queue
    // then keeps prefetches bounded without delaying the item on screen.
    const timeoutId = window.setTimeout(() => {
      nextItems.forEach((item, index) => {
        prefetchFeedItem(
          item,
          previewUseCases,
          prefetchedImageUrlsRef.current,
          prefetchControllersRef.current,
          nsfwMode,
          disabledPlugins,
          index + 1,
        );
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(releaseId);
    };
  }, [activeReviewIds, disabledPlugins, enabled, items, nextItems, nsfwMode, previewUseCases]);

  useEffect(() => () => {
    abortPrefetches(prefetchControllersRef.current);
  }, []);
}
