const CACHE_TTL_MS = 5 * 60_000;

export type PreviewLoader<T> = (signal: AbortSignal) => Promise<T>;

type RequestState = 'queued' | 'running' | 'settled';

export type PreviewRequestSettled<T> = (
  request: PreviewRequest<T>,
  failed: boolean,
) => void;

/** A single shared request and the subscribers waiting for its result. */
export class PreviewRequest<T> {
  readonly promise: Promise<T>;

  private readonly resolvePromise: (value: T) => void;
  private readonly rejectPromise: (reason?: unknown) => void;
  private state: RequestState = 'queued';
  private subscribers = 0;
  private controller?: AbortController;
  private settled = false;
  private _expiresAt: number | null = null;

  constructor(
    readonly key: string,
    private readonly load: PreviewLoader<T>,
    private readonly onSettled: PreviewRequestSettled<T>,
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
    this._expiresAt = Date.now() + CACHE_TTL_MS;
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

function createAbortError(): DOMException {
  return new DOMException('The preview request was aborted', 'AbortError');
}

function neverPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}
