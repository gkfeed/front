const MAX_CONCURRENT_PREVIEWS = 4;
const CACHE_TTL_MS = 5 * 60_000;

type CacheEntry<T> = {
  key: string;
  expiresAt: number;
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  queueEntry: QueueEntry;
  subscribers: number;
  settled: boolean;
};

type QueueEntry = {
  run: () => void;
  cancelled: boolean;
  started: boolean;
  controller?: AbortController;
};

const cache = new Map<string, CacheEntry<unknown>>();
const queue: QueueEntry[] = [];
let activeCount = 0;

export function loadQueuedPreview<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return subscribe(cached, signal);
  if (cached) cache.delete(key);

  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const state: { entry?: CacheEntry<T> } = {};
  const queueEntry: QueueEntry = {
    cancelled: false,
    started: false,
    run: () => {
      if (queueEntry.cancelled) return;
      queueEntry.started = true;
      const controller = new AbortController();
      queueEntry.controller = controller;
      load(controller.signal).then(
        (value) => {
          resolvePromise(value);
          settle(state.entry!);
        },
        (error: unknown) => {
          rejectPromise(error);
          settle(state.entry!);
        },
      );
    },
  };
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const cacheEntry: CacheEntry<T> = {
    key,
    expiresAt: Date.now() + CACHE_TTL_MS,
    promise,
    reject: rejectPromise,
    queueEntry,
    settled: false,
    subscribers: 0,
  };
  state.entry = cacheEntry;
  cache.set(key, cacheEntry);
  queue.push(queueEntry);
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  const subscribed = subscribe(cacheEntry, signal);
  runNext();
  return subscribed;
}

export function clearPreviewCache(): void {
  cache.clear();
}

function runNext(): void {
  while (activeCount < MAX_CONCURRENT_PREVIEWS) {
    const next = queue.shift();
    if (!next) return;
    if (next.cancelled) continue;
    activeCount += 1;
    next.run();
  }
}

function subscribe<T>(entry: CacheEntry<T>, signal?: AbortSignal): Promise<T> {
  entry.subscribers += 1;
  if (!signal) return entry.promise;

  if (signal.aborted) {
    release(entry);
    return neverPromise();
  }

  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      if (finished) return;
      finished = true;
      cleanup();
      release(entry);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (value) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(error);
      },
    );
  });
}

function release<T>(entry: CacheEntry<T>): void {
  if (entry.settled) return;
  entry.subscribers -= 1;
  if (entry.subscribers > 0) return;

  entry.queueEntry.cancelled = true;
  if (entry.queueEntry.started) {
    entry.queueEntry.controller?.abort();
  } else {
    rejectEntry(entry, createAbortError());
  }
  runNext();
}

function settle<T>(entry: CacheEntry<T>): void {
  entry.settled = true;
  activeCount -= 1;
  runNext();
}

function rejectEntry<T>(entry: CacheEntry<T>, error: unknown): void {
  entry.settled = true;
  if (cache.get(entry.key) === entry) cache.delete(entry.key);
  entry.reject(error);
}

function createAbortError(): DOMException {
  return new DOMException('The preview request was aborted', 'AbortError');
}

function neverPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
