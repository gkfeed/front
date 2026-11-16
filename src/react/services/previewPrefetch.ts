import { ImagePrefetchCache } from './imagePrefetchCache';
import { readerDiagnostic } from './readerDiagnostics';
import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { resolveFeedItemPreviewPolicy } from '../domain/feedItemPreviewPolicy';
import type { NsfwMode, RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';
import { EMPTY_REMOTE_PREVIEW, filterRemotePreviewForProvider } from '../domain/remotePreview';
import type { FeedItem } from '../types';
import { getProviderDataImageUrls } from '../../../shared/providerData';
import type { FeedPluginId } from '../domain/feedItemProviderPresentation';

type PreviewLoader = {
  reprioritizeRemotePreview?: (url: string, source: Exclude<RemotePreviewSource, 'none'>, priority: number) => void;
  loadRemotePreview: (
    url: string,
    source: Exclude<RemotePreviewSource, 'none'>,
    signal: AbortSignal,
    priority?: number,
  ) => Promise<RemotePreview>;
};

export function prefetchFeedItem(
  item: FeedItem,
  previewUseCases: PreviewLoader,
  prefetchedImageUrls: ImagePrefetchCache,
  prefetchControllers: Map<string, AbortController>,
  nsfwMode: NsfwMode,
  disabledPlugins: ReadonlySet<FeedPluginId> = new Set(),
  priority = 1,
): void {
  const providerView = analyzeFeedItem(item, disabledPlugins);
  const initialPolicy = resolveFeedItemPreviewPolicy({
    item,
    providerView,
    nsfwMode,
    remotePreview: EMPTY_REMOTE_PREVIEW,
    previewFailures: 0,
  });
  prefetchPreviewImages(initialPolicy.visiblePreview, prefetchedImageUrls, item.id);

  if (!initialPolicy.remoteRequest) return;

  const prefetchKey = `${initialPolicy.remoteRequest.source}:${item.link}`;
  if (prefetchControllers.has(prefetchKey)) {
    previewUseCases.reprioritizeRemotePreview?.(item.link, initialPolicy.remoteRequest.source, priority);
    return;
  }

  const controller = new AbortController();
  readerDiagnostic('item-prefetch-start', item.id, `${providerView.provider}:${initialPolicy.remoteRequest.source}:${priority}`);
  prefetchControllers.set(prefetchKey, controller);
  void previewUseCases.loadRemotePreview(
    item.link,
    initialPolicy.remoteRequest.source,
    controller.signal,
    priority,
  )
    .then((remotePreview) => {
      if (controller.signal.aborted) return;
      readerDiagnostic('item-prefetch-ready', item.id, providerView.provider);
      const loadedPolicy = resolveFeedItemPreviewPolicy({
        item,
        providerView,
        nsfwMode,
        remotePreview,
        previewFailures: 0,
      });
      prefetchRemotePreviewImages(
        filterRemotePreviewForProvider(remotePreview, providerView.provider),
        loadedPolicy.visiblePreview,
        prefetchedImageUrls,
        item.id,
      );
    })
    .catch((error: unknown) => { if (!controller.signal.aborted) readerDiagnostic('item-prefetch-error', item.id, error instanceof Error ? error.name : 'unknown'); })
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
  prefetchedImageUrls: ImagePrefetchCache,
  itemId: number,
): void {
  prefetchPreviewImages(selectedPreview, prefetchedImageUrls, itemId);

  getProviderDataImageUrls(remotePreview.openGraphPreview?.providerData ?? null)
    .forEach((url) => prefetchImage(url, prefetchedImageUrls, itemId));

  remotePreview.liquipediaMatch?.teams.forEach((team) => {
    if (team.logo) prefetchImage(team.logo, prefetchedImageUrls, itemId);
  });
}

function prefetchPreviewImages(
  preview: ReturnType<typeof resolveFeedItemPreviewPolicy>['preview'],
  prefetchedImageUrls: ImagePrefetchCache,
  itemId: number,
): void {
  if (!preview) return;
  if (preview.type === undefined) prefetchImage(preview.src, prefetchedImageUrls, itemId);
  if (preview.poster) prefetchImage(preview.poster, prefetchedImageUrls, itemId);
  if (preview.fallbackSrc) prefetchImage(preview.fallbackSrc, prefetchedImageUrls, itemId);
}

function prefetchImage(src: string, prefetchedImageUrls: ImagePrefetchCache, itemId: number): void {
  prefetchedImageUrls.prefetch(src, itemId);
}
