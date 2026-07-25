const MAX_CONCURRENT_PREVIEWS = 4;
const CACHE_TTL_MS = 5 * 60_000;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

type QueueEntry = {
  run: () => void;
};

const cache = new Map<string, CacheEntry<unknown>>();
const queue: QueueEntry[] = [];
let activeCount = 0;

export function loadQueuedPreview<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  if (cached) cache.delete(key);

  const promise = new Promise<T>((resolve, reject) => {
    queue.push({
      run: () => {
        const controller = new AbortController();
        load(controller.signal).then(resolve, reject).finally(() => {
          activeCount -= 1;
          runNext();
        });
      },
    });
    runNext();
  });

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

export function clearPreviewCache(): void {
  cache.clear();
}

function runNext(): void {
  while (activeCount < MAX_CONCURRENT_PREVIEWS) {
    const next = queue.shift();
    if (!next) return;
    activeCount += 1;
    next.run();
  }
}
