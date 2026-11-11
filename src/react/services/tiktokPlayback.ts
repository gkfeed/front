import { requestBffJson } from './bffClient';
import { isTikTokPlaybackPreview, type TikTokPlaybackPreview } from '../../../shared/tiktokContracts';

// Playback URLs are signed; keep successful speculative results only briefly.
const CACHE_MS = 10_000;
const CACHE_LIMIT = 20;
type Pending = { controller: AbortController; subscribers: number; promise: Promise<TikTokPlaybackPreview> };
const pending = new Map<string, Pending>();
const cache = new Map<string, { value: TikTokPlaybackPreview; expires: number }>();

export function fetchTikTokPlayback(url: string, signal: AbortSignal): Promise<TikTokPlaybackPreview> {
  if (signal.aborted) return Promise.reject(signal.reason);
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
  cache.delete(url);
  let entry = pending.get(url);
  if (!entry) {
    const controller = new AbortController();
    const created: Pending = { controller, subscribers: 0, promise: Promise.resolve(null as never) };
    created.promise = requestBffJson({
      endpoint: '/bff/tiktok-playback', input: url, resourceName: 'TikTok playback',
      validate: isTikTokPlaybackPreview, signal: controller.signal,
    }).then((value) => {
      if (!controller.signal.aborted) {
        cache.set(url, { value, expires: Date.now() + CACHE_MS });
        while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      }
      return value;
    }).finally(() => { if (pending.get(url) === created) pending.delete(url); });
    pending.set(url, created);
    entry = created;
  }
  const active = entry;
  active.subscribers++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener('abort', abort);
      active.subscribers--;
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(signal.reason);
      if (active.subscribers === 0 && pending.get(url) === active) {
        pending.delete(url);
        active.controller.abort();
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    active.promise.then((value) => { if (finish()) resolve(value); }, (error) => { if (finish()) reject(error); });
  });
}
