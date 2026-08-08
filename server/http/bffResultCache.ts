const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 128;
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  size: number;
};

export interface BffResultCache {
  load<T>(key: string, load: () => Promise<T>): Promise<T>;
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
  const inFlight = new Map<string, Promise<unknown>>();
  let totalBytes = 0;

  function remove(key: string, entry: CacheEntry): void {
    if (!entries.delete(key)) return;
    totalBytes -= entry.size;
  }

  return {
    async load<T>(key: string, load: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached) {
        if (cached.expiresAt > now()) {
          entries.delete(key);
          entries.set(key, cached);
          return cached.value as T;
        }
        remove(key, cached);
      }

      const pending = inFlight.get(key);
      if (pending) return pending as Promise<T>;

      const pendingLoad = load().then((value) => {
        const size = estimateSize(value);
        if (size > maxBytes) return value;
        const existing = entries.get(key);
        if (existing) remove(key, existing);
        entries.set(key, { value, expiresAt: now() + ttlMs, size });
        totalBytes += size;
        while (entries.size > maxEntries || totalBytes > maxBytes) {
          const oldest = entries.entries().next().value as [string, CacheEntry] | undefined;
          if (!oldest) break;
          remove(oldest[0], oldest[1]);
        }
        return value;
      }).finally(() => {
        inFlight.delete(key);
      });
      inFlight.set(key, pendingLoad);
      return pendingLoad;
    },
  };
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
