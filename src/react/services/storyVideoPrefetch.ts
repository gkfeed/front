import { analyzeFeedItem } from '../domain/feedItemAnalysis';
import { resolveFeedItemPreviewPolicy } from '../domain/feedItemPreviewPolicy';
import { isInstagramFeedItem } from '../domain/feedItemProviderPresentation';
import { isTempfileUrl, parseUrl } from '../domain/feedItemUrls';
import type { NsfwMode, RemotePreview } from '../domain/feedItemCardContracts';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import type { FeedItem } from '../types';
import type { prefetchFeedItem } from './previewPrefetch';

// The shared preview loader deduplicates metadata with image/metadata prefetch.
export function prefetchStoryVideo(
  item: FeedItem,
  previewUseCases: Parameters<typeof prefetchFeedItem>[1],
  nsfwMode: NsfwMode,
  priority = 1,
): () => void {
  if (!isInstagramFeedItem(item)) return () => undefined;

  const controller = new AbortController();
  const providerView = analyzeFeedItem(item);
  let video: HTMLVideoElement | undefined;
  let fallbackImage: HTMLImageElement | undefined;
  const releaseVideo = () => {
    fallbackImage?.removeAttribute('src');
    fallbackImage = undefined;
    if (!video) return;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();
    video = undefined;
  };
  const warmPreview = (remotePreview: RemotePreview) => {
    const policy = resolveFeedItemPreviewPolicy({
      item, providerView, nsfwMode, remotePreview, previewFailures: 0,
    });
    const preview = policy.visiblePreview;
    if (!controller.signal.aborted && preview?.type === 'video' && video?.src !== preview.src) {
      releaseVideo();
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      // Extensionless imports can be photos. Warm the same image fallback used
      // by the visible player if the browser cannot decode them as video.
      video.onerror = () => {
        if (controller.signal.aborted || !isTempfileUrl(parseUrl(preview.src))) return;
        fallbackImage = new Image();
        fallbackImage.referrerPolicy = 'no-referrer';
        fallbackImage.src = preview.src;
      };
      video.src = preview.src;
    }
    return policy;
  };
  const policy = warmPreview(EMPTY_REMOTE_PREVIEW);
  if (policy.remoteRequest) {
    void previewUseCases.loadRemotePreview(item.link, policy.remoteRequest.source, controller.signal, priority)
      .then(warmPreview)
      .catch(() => undefined);
  }

  return () => {
    controller.abort();
    releaseVideo();
  };
}
