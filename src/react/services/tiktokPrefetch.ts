import { BffHttpError, BffTimeoutError } from './bffClient';
import { tikTokDiagnostic } from './readerDiagnostics';
import { fetchTikTokPlayback } from './tiktokPlayback';
import { tikTokMediaProxy } from './tiktokMediaUrl';

// Share both the metadata request and the media URL with the visible player.
export function prefetchTikTok(url: string, priority = 1): () => void {
  tikTokDiagnostic('prefetch-start', url);
  const controller = new AbortController();
  let images: HTMLImageElement[] = [];
  let retryTimer: number | undefined;
  const load = (retry: boolean) => void fetchTikTokPlayback(url, controller.signal, priority).then((preview) => {
    if (controller.signal.aborted) return;
    tikTokDiagnostic('prefetch-metadata-ready', url, preview.imageUrls ? 'slideshow' : 'video');
    if (preview.imageUrls) {
      images = preview.imageUrls.slice(0, 2).map((src) => { const image = new Image(); image.src = src; return image; });
    } else {
      // Do not let detached video elements buffer entire long videos. Limit
      // the speculative transfer even if an upstream server ignores Range.
      void warmVideo(url, tikTokMediaProxy(preview.videoUrl), controller.signal);
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
  };
}

const PREFETCH_BYTES = 1024 * 1024;

async function warmVideo(postUrl: string, mediaUrl: string, signal: AbortSignal): Promise<void> {
  try {
    const response = await fetch(mediaUrl, { headers: { Range: `bytes=0-${PREFETCH_BYTES - 1}` }, signal });
    if (!response.body) return;
    const reader = response.body.getReader();
    const range = response.headers.get('content-range')?.match(/^bytes 0-(\d+)\/\d+$/i);
    if (response.status !== 206 || !range || Number(range[1]) >= PREFETCH_BYTES) {
      await reader.cancel().catch(() => undefined);
      return;
    }
    let bytes = 0;
    try {
      while (bytes <= PREFETCH_BYTES && !signal.aborted) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
      }
      tikTokDiagnostic('prefetch-media-ready', postUrl, `bytes=${bytes}`);
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  } catch {
    if (!signal.aborted) tikTokDiagnostic('prefetch-media-error', postUrl);
  }
}
