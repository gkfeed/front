import { useEffect, useMemo, useRef } from 'react';

import { abortPrefetches, prefetchFeedItem } from '../services/previewPrefetch';
import { prefetchStoryVideo } from '../services/storyVideoPrefetch';
import { getFeedItemProvider } from '../domain/feedItemProviderPresentation';
import { isNsfwLink } from '../domain/nsfw';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';
import { usePluginPreferences } from '../state/usePluginPreferences';

export const REVIEW_PREVIEW_PREFETCH_COUNT = 10;
const PREFETCH_DELAY_MS = 10;

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
  const storyPrefetchesRef = useRef<Map<number, { signature: string; dispose: () => void }>>(new Map());
  // Navigation may retain overlapping work, but a policy change invalidates it.
  useEffect(() => {
    const controllers = prefetchControllersRef.current;
    const storyPrefetches = storyPrefetchesRef.current;
    return () => {
      abortPrefetches(controllers);
      storyPrefetches.forEach(({ dispose }) => dispose());
      storyPrefetches.clear();
    };
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
  const nextStories = useMemo(() => {
    const stories = nextItems.filter((item) => getFeedItemProvider(item, disabledPlugins) === 'instagram'
      && (nsfwMode !== 'hide' || !isNsfwLink(item.link)));
    const first = stories[0];
    if (!first) return [];
    const second = stories.find((item) => item.link !== first.link && item.feedId !== first.feedId)
      ?? stories.find((item) => item.link !== first.link);
    return second ? [first, second] : [first];
  }, [disabledPlugins, nextItems, nsfwMode]);

  useEffect(() => {
    const prefetches = storyPrefetchesRef.current;
    const candidates = enabled ? nextStories : [];
    const signatures = new Map(candidates.map((item) => [item.id, JSON.stringify([item.link, item.title, item.text])]));
    for (const [id, entry] of prefetches) {
      if (signatures.get(id) === entry.signature) continue;
      entry.dispose();
      prefetches.delete(id);
    }
    if (candidates.length === 0) return undefined;

    // Give the visible card a chance to start before speculative video loads.
    const timeoutId = window.setTimeout(() => {
      for (const item of candidates) {
        if (prefetches.has(item.id)) continue;
        const priority = nextItems.findIndex(({ id }) => id === item.id) + 1;
        prefetches.set(item.id, {
          signature: signatures.get(item.id)!,
          dispose: prefetchStoryVideo(item, previewUseCases, nsfwMode, priority),
        });
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [enabled, nextItems, nextStories, nsfwMode, previewUseCases]);

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
    // Reorder work that is already queued before cancellations release slots.
    const itemsById = new Map(items.map((item) => [item.id, item]));
    activeReviewIds.slice(1, REVIEW_PREVIEW_PREFETCH_COUNT + 1).forEach((id, index) => {
      const item = itemsById.get(id);
      if (!item) return;
      previewUseCases.reprioritizeRemotePreview?.(item.link, 'open-graph', index + 1);
      previewUseCases.reprioritizeRemotePreview?.(item.link, 'liquipedia', index + 1);
    });
    for (const [key, controller] of prefetchControllersRef.current) {
      if (retainedKeys.has(key)) continue;
      controller.abort();
      prefetchControllersRef.current.delete(key);
    }
    if (nextItems.length === 0) return undefined;

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
    }, PREFETCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeReviewIds, disabledPlugins, enabled, items, nextItems, nsfwMode, previewUseCases]);

  useEffect(() => () => {
    abortPrefetches(prefetchControllersRef.current);
  }, []);
}
