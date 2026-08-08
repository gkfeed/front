import { describe, expect, it, vi } from 'vitest';

import { createBffResultCache } from './bffResultCache.js';

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

    expect(load).toHaveBeenCalledOnce();
    release('shared');
    await expect(Promise.all([first, second])).resolves.toEqual(['shared', 'shared']);
  });
});
