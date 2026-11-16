import { isTikTokPlaybackPreview, type TikTokPlaybackPreview } from '../../../shared/tiktokContracts';
import { requestBffJson } from './bffClient';
import { loadQueuedPreview, peekQueuedPreview, queuedPreviewState, reprioritizeQueuedPreview } from './previewQueue';
import { tikTokDiagnostic } from './readerDiagnostics';

// Playback URLs are signed; keep successful speculative results only briefly.
const CACHE_MS = 30_000;
const keyFor = (url: string) => `tiktok-playback:${url}`;

export function getCachedTikTokPlayback(url: string): TikTokPlaybackPreview | undefined {
  return peekQueuedPreview<TikTokPlaybackPreview>(keyFor(url))?.value;
}

export function fetchTikTokPlayback(url: string, signal: AbortSignal, priority = 0): Promise<TikTokPlaybackPreview> {
  if (signal.aborted) return Promise.reject(signal.reason);
  const key = keyFor(url);
  const state = queuedPreviewState(key);
  if (state === 'settled') tikTokDiagnostic('metadata-cache-hit', url);
  else if (state === 'pending') tikTokDiagnostic('metadata-join', url);
  else tikTokDiagnostic('metadata-queued', url, `priority=${priority}`);
  return loadQueuedPreview(key, (requestSignal) => {
    tikTokDiagnostic('metadata-request-start', url);
    return requestBffJson({
      endpoint: '/bff/tiktok-playback', input: url, resourceName: 'TikTok playback',
      validate: isTikTokPlaybackPreview, signal: requestSignal,
    }).then((value) => {
      tikTokDiagnostic('metadata-request-ready', url);
      if (import.meta.env.DEV && value.videoUrl) {
        const params = new URL(value.videoUrl).searchParams;
        const expiry = params.get('x-expires') ?? params.get('expires') ?? params.get('expire');
        const numeric = expiry && /^\d{9,16}$/.test(expiry) ? Number(expiry) : null;
        const expiryMs = numeric === null ? null : numeric < 1e12 ? numeric * 1_000 : numeric;
        tikTokDiagnostic('metadata-url-expiration', url,
          expiryMs === null ? 'not-provided' : `remaining-seconds=${Math.floor((expiryMs - Date.now()) / 1_000)}`);
      }
      return value;
    }).catch((error: unknown) => {
      const detail = error instanceof Error
        ? `${error.name}${'status' in error && typeof error.status === 'number' ? `:${error.status}` : ''}`
        : 'unknown';
      tikTokDiagnostic('metadata-request-error', url, detail);
      throw error;
    });
  }, signal, priority, CACHE_MS);
}

export function reprioritizeTikTokPlayback(url: string, priority: number): void {
  reprioritizeQueuedPreview(keyFor(url), priority);
}
