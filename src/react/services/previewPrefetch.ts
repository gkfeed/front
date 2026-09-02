import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { resolveFeedItemPreviewPolicy } from '../domain/feedItemPreviewPolicy';
import type { NsfwMode, RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import type { FeedItem } from '../types';
import { getProviderDataImageUrls } from '../../../shared/providerData';

type PreviewLoader = {
  loadRemotePreview: (
    url: string,
    source: Exclude<RemotePreviewSource, 'none'>,
    signal: AbortSignal,
  ) => Promise<RemotePreview>;
};

export function prefetchFeedItem(
  item: FeedItem,
  previewUseCases: PreviewLoader,
  prefetchedImageUrls: Set<string>,
  prefetchControllers: Map<string, AbortController>,
  nsfwMode: NsfwMode,
): void {
  const providerView = analyzeFeedItem(item);
  const initialPolicy = resolveFeedItemPreviewPolicy({
    item,
    providerView,
    nsfwMode,
    remotePreview: EMPTY_REMOTE_PREVIEW,
    previewFailures: 0,
  });
  prefetchPreviewImages(initialPolicy.visiblePreview, prefetchedImageUrls);

  if (!initialPolicy.remoteRequest) return;

  const prefetchKey = `${initialPolicy.remoteRequest.source}:${item.link}`;
  if (prefetchControllers.has(prefetchKey)) return;

  const controller = new AbortController();
  prefetchControllers.set(prefetchKey, controller);
  void previewUseCases.loadRemotePreview(
    item.link,
    initialPolicy.remoteRequest.source,
    controller.signal,
  )
    .then((remotePreview) => {
      const loadedPolicy = resolveFeedItemPreviewPolicy({
        item,
        providerView,
        nsfwMode,
        remotePreview,
        previewFailures: 0,
      });
      prefetchRemotePreviewImages(remotePreview, loadedPolicy.visiblePreview, prefetchedImageUrls);
    })
    .catch(() => undefined)
    .finally(() => {
      if (prefetchControllers.get(prefetchKey) === controller) {
        prefetchControllers.delete(prefetchKey);
      }
    });
}

export function abortPrefetches(prefetchControllers: Map<string, AbortController>): void {
  prefetchControllers.forEach((controller) => controller.abort());
  prefetchControllers.clear();
}

function prefetchRemotePreviewImages(
  remotePreview: RemotePreview,
  selectedPreview: ReturnType<typeof resolveFeedItemPreviewPolicy>['preview'],
  prefetchedImageUrls: Set<string>,
): void {
  prefetchPreviewImages(selectedPreview, prefetchedImageUrls);

  getProviderDataImageUrls(remotePreview.openGraphPreview?.providerData ?? null)
    .forEach((url) => prefetchImage(url, prefetchedImageUrls));

  remotePreview.liquipediaMatch?.teams.forEach((team) => {
    if (team.logo) prefetchImage(team.logo, prefetchedImageUrls);
  });
}

function prefetchPreviewImages(
  preview: ReturnType<typeof resolveFeedItemPreviewPolicy>['preview'],
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
