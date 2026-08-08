import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewCache } from './previewQueueCache';
import type { PreviewRequest, PreviewRequestControl } from './previewQueueRequest';

afterEach(() => {
  vi.useRealTimers();
});

function settledEntry(expiresAt: number): PreviewRequestControl {
  return {
    isSettled: true,
    expiresAt,
    start() {},
    cancel() {},
  };
}

function put(cache: PreviewCache, key: string, entry: PreviewRequestControl): void {
  cache.set(key, entry as PreviewRequest<unknown>);
  cache.settled();
}

describe('PreviewCache', () => {
  it('keeps only the configured number of least-recently-used completed values', () => {
    const cache = new PreviewCache(2);
    const expiration = Date.now() + 60_000;

    put(cache, 'first', settledEntry(expiration));
    put(cache, 'second', settledEntry(expiration));
    expect(cache.get('first')).toBeDefined();
    put(cache, 'third', settledEntry(expiration));

    expect(cache.get('first')).toBeDefined();
    expect(cache.get('second')).toBeUndefined();
    expect(cache.get('third')).toBeDefined();
    cache.clear();
  });

  it('actively removes values when their TTL expires without another lookup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const cache = new PreviewCache();
    put(cache, 'preview', settledEntry(Date.now() + 1_000));

    vi.advanceTimersByTime(1_000);

    expect(cache.clear()).toEqual([]);
  });
});
