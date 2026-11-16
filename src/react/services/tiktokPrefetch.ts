import { BffHttpError, BffTimeoutError } from './bffClient';
import { tikTokDiagnostic, tikTokMediaDiagnostic } from './readerDiagnostics';
import { fetchTikTokPlayback } from './tiktokPlayback';
import { tikTokMediaProxy } from './tiktokMediaUrl';

// Share both the metadata request and the media URL with the visible player.
export function prefetchTikTok(url: string, priority = 1): () => void {
  tikTokDiagnostic('prefetch-start', url);
  const controller = new AbortController();
  let video: HTMLVideoElement | undefined;
  let images: HTMLImageElement[] = [];
  let retryTimer: number | undefined;
  const load = (retry: boolean) => void fetchTikTokPlayback(url, controller.signal, priority).then((preview) => {
    if (controller.signal.aborted) return;
    tikTokDiagnostic('prefetch-metadata-ready', url, preview.imageUrls ? 'slideshow' : 'video');
    if (preview.imageUrls) {
      images = preview.imageUrls.slice(0, 2).map((src) => { const image = new Image(); image.src = src; return image; });
    } else {
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.addEventListener('loadedmetadata', () => tikTokDiagnostic('prefetch-loadedmetadata', url));
      video.addEventListener('loadeddata', () => { if (video) tikTokMediaDiagnostic('prefetch-loadeddata', url, video); });
      video.addEventListener('error', () => tikTokDiagnostic('prefetch-media-error', url));
      video.src = tikTokMediaProxy(preview.videoUrl);
    }
  }).catch((error: unknown) => {
    if (controller.signal.aborted) return;
    tikTokDiagnostic('prefetch-error', url, error instanceof Error ? error.name : 'unknown');
    const transient = error instanceof BffTimeoutError || error instanceof TypeError
      || (error instanceof BffHttpError && (error.status === 429 || error.status >= 500));
    if (!retry && transient) {
      retryTimer = window.setTimeout(() => {
        tikTokDiagnostic('prefetch-retry', url);
        load(true);
      }, 3_000);
    }
  });
  load(false);
  return () => {
    tikTokDiagnostic('prefetch-dispose', url);
    controller.abort();
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    images.forEach((image) => image.removeAttribute('src'));
    images = [];
    if (video) { video.removeAttribute('src'); video.load(); video = undefined; }
  };
}
