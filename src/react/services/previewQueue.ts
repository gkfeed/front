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

class PreviewQueue {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly queue: QueueEntry[] = [];
  private activeCount = 0;

  load<T>(
    key: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return this.subscribe(cached, signal);
    if (cached) this.cache.delete(key);

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
            this.settle(state.entry!);
          },
          (error: unknown) => {
            rejectPromise(error);
            this.settle(state.entry!);
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
    this.cache.set(key, cacheEntry);
    this.queue.push(queueEntry);
    promise.catch(() => {
      if (this.cache.get(key)?.promise === promise) this.cache.delete(key);
    });

    const subscribed = this.subscribe(cacheEntry, signal);
    this.runNext();
    return subscribed;
  }

  clear(): void {
    this.cache.clear();
  }

  private runNext(): void {
    while (this.activeCount < MAX_CONCURRENT_PREVIEWS) {
      const next = this.queue.shift();
      if (!next) return;
      if (next.cancelled) continue;
      this.activeCount += 1;
      next.run();
    }
  }

  private subscribe<T>(entry: CacheEntry<T>, signal?: AbortSignal): Promise<T> {
    entry.subscribers += 1;
    if (!signal) return entry.promise;

    if (signal.aborted) {
      this.release(entry);
      return neverPromise();
    }

    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => {
        if (finished) return;
        finished = true;
        cleanup();
        this.release(entry);
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

  private release<T>(entry: CacheEntry<T>): void {
    if (entry.settled) return;
    entry.subscribers -= 1;
    if (entry.subscribers > 0) return;

    entry.queueEntry.cancelled = true;
    if (entry.queueEntry.started) {
      entry.queueEntry.controller?.abort();
    } else {
      this.rejectEntry(entry, createAbortError());
    }
    this.runNext();
  }

  private settle<T>(entry: CacheEntry<T>): void {
    entry.settled = true;
    this.activeCount -= 1;
    this.runNext();
  }

  private rejectEntry<T>(entry: CacheEntry<T>, error: unknown): void {
    entry.settled = true;
    if (this.cache.get(entry.key) === entry) this.cache.delete(entry.key);
    entry.reject(error);
  }
}

const previewQueue = new PreviewQueue();

export function loadQueuedPreview<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  return previewQueue.load(key, load, signal);
}

export function clearPreviewCache(): void {
  previewQueue.clear();
}

function createAbortError(): DOMException {
  return new DOMException('The preview request was aborted', 'AbortError');
}

function neverPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
