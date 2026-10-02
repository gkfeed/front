import { describe, expect, it, vi } from 'vitest';

import { createBffResultCache } from './bffResultCache.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

function context(controller: AbortController): RequestExecutionContext {
  return {
    signal: controller.signal,
    deadline: Number.POSITIVE_INFINITY,
    remainingMs: (maximum = Number.POSITIVE_INFINITY) => maximum,
  };
}

describe('BFF result cache', () => {
  it('reuses successful results until their TTL expires', async () => {
    let timestamp = 1_000;
    const cache = createBffResultCache({ ttlMs: 100, now: () => timestamp });
    const load = vi.fn().mockResolvedValue({ title: 'Story' });

    await expect(cache.load('open-graph:story', load)).resolves.toEqual({ title: 'Story' });
    await expect(cache.load('open-graph:story', load)).resolves.toEqual({ title: 'Story' });
    expect(load).toHaveBeenCalledOnce();

    timestamp += 100;
    await cache.load('open-graph:story', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('evicts least-recently-used entries at the configured bound', async () => {
    const cache = createBffResultCache({ maxEntries: 2 });
    const loadA = vi.fn().mockResolvedValue('a');
    const loadB = vi.fn().mockResolvedValue('b');
    const loadC = vi.fn().mockResolvedValue('c');

    await cache.load('a', loadA);
    await cache.load('b', loadB);
    await cache.load('a', loadA);
    await cache.load('c', loadC);
    await cache.load('b', loadB);

    expect(loadA).toHaveBeenCalledOnce();
    expect(loadB).toHaveBeenCalledTimes(2);
  });

  it('does not retain failed loads', async () => {
    const cache = createBffResultCache();
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('upstream failed'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.load('key', load)).rejects.toThrow('upstream failed');
    await expect(cache.load('key', load)).resolves.toBe('recovered');
  });

  it('coalesces concurrent loads for the same URL', async () => {
    const cache = createBffResultCache();
    let release!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => { release = resolve; }));

    const first = cache.load('key', load);
    const second = cache.load('key', load);

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    release('shared');
    await expect(Promise.all([first, second])).resolves.toEqual(['shared', 'shared']);
  });

  it('keeps the shared load running when one subscriber disconnects', async () => {
    const cache = createBffResultCache();
    const firstController = new AbortController();
    const secondController = new AbortController();
    let release!: (value: string) => void;
    let upstreamSignal!: AbortSignal;
    const load = vi.fn((sharedContext: RequestExecutionContext) => {
      upstreamSignal = sharedContext.signal;
      return new Promise<string>((resolve) => { release = resolve; });
    });

    const first = cache.load('key', load, { context: context(firstController) });
    const second = cache.load('key', load, { context: context(secondController) });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    firstController.abort();

    await expect(first).rejects.toThrow('Request aborted');
    expect(upstreamSignal.aborted).toBe(false);
    release('shared');
    await expect(second).resolves.toBe('shared');
  });

  it('aborts upstream after the last subscriber leaves and starts a fresh load', async () => {
    const cache = createBffResultCache();
    const controller = new AbortController();
    let upstreamSignal!: AbortSignal;
    const first = cache.load('key', (sharedContext) => {
      upstreamSignal = sharedContext.signal;
      return new Promise<string>(() => undefined);
    }, { context: context(controller) });
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
    controller.abort();

    await expect(first).rejects.toThrow('Request aborted');
    expect(upstreamSignal.aborted).toBe(true);
    await expect(cache.load('key', async () => 'fresh')).resolves.toBe('fresh');
  });

  it('honors a shorter TTL for one resource without shortening others', async () => {
    let timestamp = 1_000;
    const cache = createBffResultCache({ now: () => timestamp });
    const live = vi.fn().mockResolvedValue('live');
    const article = vi.fn().mockResolvedValue('article');
    await cache.load('live', live, { ttlMs: 20_000 });
    await cache.load('article', article);

    timestamp += 30_000;
    await cache.load('live', live, { ttlMs: 20_000 });
    await cache.load('article', article);

    expect(live).toHaveBeenCalledTimes(2);
    expect(article).toHaveBeenCalledOnce();
  });

  it('coalesces live loads without retaining their result for the next refresh', async () => {
    const cache = createBffResultCache();
    let release!: (value: string) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => { release = resolve; }))
      .mockResolvedValueOnce('updated');

    const first = cache.load('live', load, { ttlMs: 0 });
    const concurrent = cache.load('live', load, { ttlMs: 0 });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    release('initial');
    await expect(Promise.all([first, concurrent])).resolves.toEqual(['initial', 'initial']);
    await expect(cache.load('live', load, { ttlMs: 0 })).resolves.toBe('updated');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
