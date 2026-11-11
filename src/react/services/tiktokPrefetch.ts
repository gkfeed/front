import { fetchTikTokPlayback } from './tiktokPlayback';

// The visible player shares the metadata request; the element also warms media where the server permits caching.
export function prefetchTikTok(url: string): () => void {
  const controller = new AbortController();
  let video: HTMLVideoElement | undefined;
  let images: HTMLImageElement[] = [];
  void fetchTikTokPlayback(url, controller.signal).then((preview) => {
    if (controller.signal.aborted) return;
    if (preview.imageUrls) {
      images = preview.imageUrls.slice(0, 2).map((src) => { const image = new Image(); image.src = src; return image; });
    } else {
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.src = preview.videoUrl;
    }
  }).catch(() => undefined);
  return () => {
    controller.abort();
    images.forEach((image) => image.removeAttribute('src'));
    images = [];
    if (video) { video.removeAttribute('src'); video.load(); video = undefined; }
  };
}
