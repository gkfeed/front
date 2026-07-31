const MAX_CONCURRENT_PREVIEWS = 4;
const CACHE_TTL_MS = 5 * 60_000;

type PreviewLoader<T> = (signal: AbortSignal) => Promise<T>;

type RequestState = 'queued' | 'running' | 'settled';

/** A single shared request and the subscribers waiting for its result. */
class PreviewRequest<T> {
  readonly promise: Promise<T>;

  private readonly resolvePromise: (value: T) => void;
  private readonly rejectPromise: (reason?: unknown) => void;
  private state: RequestState = 'queued';
  private subscribers = 0;
  private controller?: AbortController;
  private settled = false;

  constructor(
    readonly key: string,
    private readonly load: PreviewLoader<T>,
    private readonly onSettled: (request: PreviewRequest<T>, failed: boolean) => void,
  ) {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    this.promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    this.resolvePromise = resolve;
    this.rejectPromise = reject;
    this.promise.catch(() => undefined);
  }

  get isSettled(): boolean {
    return this.settled;
  }

  get expiresAt(): number | null {
    return this._expiresAt;
  }

  private _expiresAt: number | null = null;

  set expiresAt(value: number | null) {
    this._expiresAt = value;
  }

  start(): void {
    if (this.state !== 'queued') return;
    this.state = 'running';
    const controller = new AbortController();
    this.controller = controller;

    let result: Promise<T>;
    try {
      result = this.load(controller.signal);
    } catch (error: unknown) {
      this.fail(error);
      return;
    }

    Promise.resolve(result).then(
      (value) => this.succeed(value),
      (error: unknown) => this.fail(error),
    );
  }

  subscribe(signal?: AbortSignal): Promise<T> {
    this.subscribers += 1;
    if (!signal) return this.promise;

    if (signal.aborted) {
      this.release();
      return neverPromise();
    }

    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const onAbort = () => {
        if (finished) return;
        finished = true;
        cleanup();
        this.release();
      };

      signal.addEventListener('abort', onAbort, { once: true });
      this.promise.then(
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

  cancel(): void {
    if (this.settled) return;
    this.controller?.abort();
    this.fail(createAbortError());
  }

  private release(): void {
    if (this.settled) return;
    this.subscribers -= 1;
    if (this.subscribers === 0) this.cancel();
  }

  private succeed(value: T): void {
    if (this.settled) return;
    this.expiresAt = Date.now() + CACHE_TTL_MS;
    this.settled = true;
    this.state = 'settled';
    this.onSettled(this, false);
    this.resolvePromise(value);
  }

  private fail(error: unknown): void {
    if (this.settled) return;
    this.settled = true;
    this.state = 'settled';
    this.onSettled(this, true);
    this.rejectPromise(error);
  }
}

/** Stores shared requests and owns expiration of completed preview values. */
class PreviewCache {
  private readonly entries = new Map<string, PreviewRequest<unknown>>();

  get<T>(key: string): PreviewRequest<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.delete(key, entry);
      return undefined;
    }
    return entry as PreviewRequest<T>;
  }

  set<T>(key: string, entry: PreviewRequest<T>): void {
    this.entries.set(key, entry as PreviewRequest<unknown>);
  }

  delete<T>(key: string, entry: PreviewRequest<T>): void {
    if (this.entries.get(key) === entry) this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

/** Schedules requests independently from the cache and subscriber lifecycle. */
class PreviewScheduler {
  private readonly queue: Array<PreviewRequest<unknown>> = [];
  private readonly active = new Set<PreviewRequest<unknown>>();

  enqueue<T>(request: PreviewRequest<T>): void {
    this.queue.push(request as PreviewRequest<unknown>);
    this.runNext();
  }

  settled<T>(request: PreviewRequest<T>): void {
    if (this.active.delete(request as PreviewRequest<unknown>)) this.runNext();
  }

  private runNext(): void {
    while (this.active.size < MAX_CONCURRENT_PREVIEWS) {
      const next = this.queue.shift();
      if (!next) return;
      if (next.isSettled) continue;
      this.active.add(next);
      next.start();
    }
  }
}

class PreviewQueue {
  private readonly cache = new PreviewCache();
  private readonly scheduler = new PreviewScheduler();

  load<T>(key: string, load: PreviewLoader<T>, signal?: AbortSignal): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return cached.subscribe(signal);

    const request = new PreviewRequest<T>(key, load, (settled, failed) => {
      this.scheduler.settled(settled);
      if (failed) this.cache.delete(key, settled);
    });
    this.cache.set(key, request);

    const subscribed = request.subscribe(signal);
    this.scheduler.enqueue(request);
    return subscribed;
  }

  clear(): void {
    this.cache.clear();
  }
}

const previewQueue = new PreviewQueue();

export function loadQueuedPreview<T>(
  key: string,
  load: PreviewLoader<T>,
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
