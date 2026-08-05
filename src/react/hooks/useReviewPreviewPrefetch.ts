import { useEffect, useMemo, useRef } from 'react';

import { analyzeFeedItem, getRemoteFeedItemPreview } from '../domain/feedItemPreview';
import { shouldLoadRemotePreview } from '../domain/feedItemCardPresentation';
import type { RemotePreview } from '../domain/feedItemCardContracts';
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
    if (!enabled || nextItems.length === 0) return undefined;

    // Let the current card enqueue its request first. The shared preview queue
    // then keeps prefetches bounded without delaying the item on screen.
    const prefetchControllers = new Set<AbortController>();
    const timeoutId = window.setTimeout(() => {
      nextItems.forEach((item) => {
        prefetchFeedItem(
          item,
          previewUseCases,
          prefetchedImageUrlsRef.current,
          prefetchControllers,
        );
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      prefetchControllers.forEach((controller) => controller.abort());
      prefetchControllers.clear();
    };
  }, [enabled, nextItems, previewUseCases]);
}

function prefetchFeedItem(
  item: FeedItem,
  previewUseCases: ReturnType<typeof useFeatureUseCases>['preview'],
  prefetchedImageUrls: Set<string>,
  prefetchControllers: Set<AbortController>,
): void {
  const analysis = analyzeFeedItem(item);
  prefetchPreviewImages(analysis.localPreview, prefetchedImageUrls);

  if (!shouldLoadRemotePreview(item, analysis, false)) return;

  const controller = new AbortController();
  prefetchControllers.add(controller);
  void previewUseCases.loadRemotePreview(
    item.link,
    analysis.provider === 'liquipedia',
    controller.signal,
  )
    .then((remotePreview) => {
      prefetchRemotePreviewImages(item, remotePreview, prefetchedImageUrls);
    })
    .catch(() => undefined)
    .finally(() => prefetchControllers.delete(controller));
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
