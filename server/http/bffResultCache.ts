import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { REQUEST_DEADLINE_MS } from '../timeouts.js';
import { HttpRequestError } from './httpErrors.js';

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 128;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  size: number;
};

type InFlightEntry = {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
  dispose: () => void;
};

export type BffCacheLoadOptions = {
  context?: RequestExecutionContext;
  ttlMs?: number;
};

export interface BffResultCache {
  load<T>(
    key: string,
    load: (context: RequestExecutionContext) => Promise<T>,
    options?: BffCacheLoadOptions,
  ): Promise<T>;
}

export interface BffResultCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  maxBytes?: number;
  now?: () => number;
}

export function createBffResultCache({
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxBytes = DEFAULT_MAX_BYTES,
  now = Date.now,
}: BffResultCacheOptions = {}): BffResultCache {
  const entries = new Map<string, CacheEntry>();
  const inFlight = new Map<string, InFlightEntry>();
  let totalBytes = 0;

  function remove(key: string, entry: CacheEntry): void {
    if (!entries.delete(key)) return;
    totalBytes -= entry.size;
  }

  function subscribe<T>(key: string, entry: InFlightEntry, context?: RequestExecutionContext): Promise<T> {
    entry.subscribers += 1;

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        context?.signal.removeEventListener('abort', onAbort);
        entry.subscribers -= 1;
        if (entry.subscribers === 0 && inFlight.get(key) === entry) {
          inFlight.delete(key);
          entry.controller.abort();
          entry.dispose();
        }
        return true;
      };
      const onAbort = () => {
        if (finish()) reject(abortError(context));
      };

      context?.signal.addEventListener('abort', onAbort, { once: true });
      if (context?.signal.aborted) onAbort();
      entry.promise.then(
        (value) => { if (finish()) resolve(value as T); },
        (error: unknown) => { if (finish()) reject(error); },
      );
    });
  }

  return {
    load<T>(
      key: string,
      load: (context: RequestExecutionContext) => Promise<T>,
      options: BffCacheLoadOptions = {},
    ): Promise<T> {
      if (options.context?.signal.aborted) return Promise.reject(abortError(options.context));
      const cached = entries.get(key);
      if (cached) {
        if (cached.expiresAt > now()) {
          entries.delete(key);
          entries.set(key, cached);
          return Promise.resolve(cached.value as T);
        }
        remove(key, cached);
      }

      const pending = inFlight.get(key);
      if (pending) return subscribe<T>(key, pending, options.context);

      const controller = new AbortController();
      const deadline = Date.now() + REQUEST_DEADLINE_MS;
      const timer = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);
      const sharedContext: RequestExecutionContext = {
        signal: controller.signal,
        deadline,
        remainingMs(maximum = Number.POSITIVE_INFINITY) {
          return Math.max(0, Math.min(maximum, deadline - Date.now()));
        },
      };
      const entry: InFlightEntry = {
        promise: Promise.resolve(),
        controller,
        subscribers: 0,
        dispose: () => clearTimeout(timer),
      };
      entry.promise = runSharedLoad(load, sharedContext, controller).then((value) => {
        if (controller.signal.aborted) throw abortError(sharedContext);
        const size = estimateSize(value);
        if (size > maxBytes) return value;
        const existing = entries.get(key);
        if (existing) remove(key, existing);
        entries.set(key, { value, expiresAt: now() + (options.ttlMs ?? ttlMs), size });
        totalBytes += size;
        while (entries.size > maxEntries || totalBytes > maxBytes) {
          const oldest = entries.entries().next().value as [string, CacheEntry] | undefined;
          if (!oldest) break;
          remove(oldest[0], oldest[1]);
        }
        return value;
      }).finally(() => {
        if (inFlight.get(key) === entry) inFlight.delete(key);
        entry.dispose();
      });
      inFlight.set(key, entry);
      return subscribe<T>(key, entry, options.context);
    },
  };
}

function runSharedLoad<T>(
  load: (context: RequestExecutionContext) => Promise<T>,
  context: RequestExecutionContext,
  controller: AbortController,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(context));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw abortError(context);
      return load(context);
    }).then(resolve, reject).finally(() => {
      controller.signal.removeEventListener('abort', onAbort);
    });
  });
}

function abortError(context?: RequestExecutionContext): Error {
  return context && context.remainingMs() <= 0
    ? new HttpRequestError('Request deadline exceeded', 'request_timeout', 504)
    : new Error('Request aborted');
}

function estimateSize(value: unknown): number {
  if (value && typeof value === 'object' && 'body' in value) {
    const body = (value as { body?: unknown }).body;
    if (body instanceof Uint8Array) return body.byteLength;
  }
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export const bffResultCache = createBffResultCache();
