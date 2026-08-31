import { useEffect, useMemo, useRef } from 'react';

import { analyzeFeedItem, getRemoteFeedItemPreview } from '../domain/feedItemPreview';
import { shouldLoadRemotePreview } from '../domain/feedItemCardPresentation';
import type { RemotePreview } from '../domain/feedItemCardContracts';
import { getFeedItemProviderPolicy } from '../domain/feedItemProviderPolicies';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
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
        );
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [enabled, nextItems, previewUseCases]);

  useEffect(() => () => {
    abortPrefetches(prefetchControllersRef.current);
  }, []);
}

function prefetchFeedItem(
  item: FeedItem,
  previewUseCases: ReturnType<typeof useFeatureUseCases>['preview'],
  prefetchedImageUrls: Set<string>,
  prefetchControllers: Map<string, AbortController>,
): void {
  const analysis = analyzeFeedItem(item);
  const providerPolicy = getFeedItemProviderPolicy(analysis.provider);
  prefetchPreviewImages(analysis.localPreview, prefetchedImageUrls);

  if (
    !shouldLoadRemotePreview(item, analysis, false)
    || providerPolicy.remotePreview === 'none'
  ) return;

  const prefetchKey = `${providerPolicy.remotePreview}:${item.link}`;
  if (prefetchControllers.has(prefetchKey)) return;

  const controller = new AbortController();
  prefetchControllers.set(prefetchKey, controller);
  void previewUseCases.loadRemotePreview(
    item.link,
    providerPolicy.remotePreview,
    controller.signal,
  )
    .then((remotePreview) => {
      prefetchRemotePreviewImages(item, remotePreview, prefetchedImageUrls);
    })
    .catch(() => undefined)
    .finally(() => {
      if (prefetchControllers.get(prefetchKey) === controller) {
        prefetchControllers.delete(prefetchKey);
      }
    });
}

function abortPrefetches(prefetchControllers: Map<string, AbortController>): void {
  prefetchControllers.forEach((controller) => controller.abort());
  prefetchControllers.clear();
}

function prefetchRemotePreviewImages(
  item: FeedItem,
  remotePreview: RemotePreview,
  prefetchedImageUrls: Set<string>,
): void {
  const openGraphPreview = remotePreview.openGraphPreview;
  if (openGraphPreview?.image) prefetchImage(openGraphPreview.image, prefetchedImageUrls);

  const remoteItemPreview = getRemoteFeedItemPreview(openGraphPreview, item.title);
  prefetchPreviewImages(remoteItemPreview, prefetchedImageUrls);

  if (openGraphPreview?.providerData?.provider === 'hltv') {
    openGraphPreview.providerData.snapshot.teams?.forEach((team) => {
      if (team.logo) prefetchImage(team.logo, prefetchedImageUrls);
    });
  }

  remotePreview.liquipediaMatch?.teams.forEach((team) => {
    if (team.logo) prefetchImage(team.logo, prefetchedImageUrls);
  });
}

function prefetchPreviewImages(
  preview: ReturnType<typeof analyzeFeedItem>['localPreview']
    | ReturnType<typeof getRemoteFeedItemPreview>,
  prefetchedImageUrls: Set<string>,
): void {
  if (!preview) return;
  if (preview.type === undefined) prefetchImage(preview.src, prefetchedImageUrls);
  if (preview.poster) prefetchImage(preview.poster, prefetchedImageUrls);
  if (preview.fallbackSrc) prefetchImage(preview.fallbackSrc, prefetchedImageUrls);
}

function prefetchImage(src: string, prefetchedImageUrls: Set<string>): void {
  if (!src || prefetchedImageUrls.has(src) || typeof Image === 'undefined') return;

  prefetchedImageUrls.add(src);
  const image = new Image();
  image.referrerPolicy = 'no-referrer';
  image.onerror = () => prefetchedImageUrls.delete(src);
  image.src = src;
}
