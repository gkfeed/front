import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { getRemoteFeedItemPreview } from '../domain/feedItemRemotePreview';
import { shouldLoadRemotePreview } from '../domain/feedItemCardPresentation';
import type { RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';
import { getFeedItemProviderLoadingRules } from '../domain/feedItemProviderPresentation';
import type { FeedItem } from '../types';

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
): void {
  const analysis = analyzeFeedItem(item);
  const loading = getFeedItemProviderLoadingRules(analysis.provider);
  prefetchPreviewImages(analysis.localPreview, prefetchedImageUrls);

  if (
    !shouldLoadRemotePreview(item, analysis, false)
    || loading.remotePreview === 'none'
  ) return;

  const prefetchKey = `${loading.remotePreview}:${item.link}`;
  if (prefetchControllers.has(prefetchKey)) return;

  const controller = new AbortController();
  prefetchControllers.set(prefetchKey, controller);
  void previewUseCases.loadRemotePreview(
    item.link,
    loading.remotePreview,
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

export function abortPrefetches(prefetchControllers: Map<string, AbortController>): void {
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

  if (openGraphPreview?.providerData?.provider === 'onefootball') {
    openGraphPreview.providerData.snapshot.teams.forEach((team) => {
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
