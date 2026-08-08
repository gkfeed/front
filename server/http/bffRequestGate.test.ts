import { describe, expect, it, vi } from 'vitest';

import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { createBffRequestGate } from './bffRequestGate.js';

describe('BFF request gate', () => {
  it('limits concurrency per client while letting another client use available capacity', async () => {
    const gate = createBffRequestGate({
      maxActive: 3,
      maxActivePerClient: 1,
      maxQueued: 3,
      maxQueuedPerClient: 2,
    });
    const releases: Array<() => void> = [];
    const load = vi.fn(() => new Promise<string>((resolve) => releases.push(() => resolve('done'))));
    const context = createDetachedRequestExecutionContext();

    const first = gate.run('client-a', context, load);
    const queued = gate.run('client-a', context, load);
    const otherClient = gate.run('client-b', context, load);

    expect(load).toHaveBeenCalledTimes(2);
    releases[0]();
    await first;
    expect(load).toHaveBeenCalledTimes(3);
    releases[1]();
    releases[2]();
    await expect(Promise.all([queued, otherClient])).resolves.toEqual(['done', 'done']);
  });

  it('rejects requests when the bounded per-client queue is full', async () => {
    const gate = createBffRequestGate({
      maxActive: 1,
      maxActivePerClient: 1,
      maxQueued: 1,
      maxQueuedPerClient: 1,
    });
    let release!: () => void;
    const context = createDetachedRequestExecutionContext();
    const first = gate.run('client-a', context, () => new Promise<void>((resolve) => { release = resolve; }));
    const queued = gate.run('client-a', context, async () => undefined);

    await expect(gate.run('client-a', context, async () => undefined)).rejects.toMatchObject({
      kind: 'preview_busy',
    });
    release();
    await Promise.all([first, queued]);
  });

  it('rate limits each client independently and resets the fixed window', async () => {
    let timestamp = 1_000;
    const gate = createBffRequestGate({ rateLimit: 2, rateWindowMs: 100, now: () => timestamp });
    const context = createDetachedRequestExecutionContext();

    await gate.run('client-a', context, async () => undefined);
    await gate.run('client-a', context, async () => undefined);
    await expect(gate.run('client-a', context, async () => undefined)).rejects.toMatchObject({
      kind: 'preview_rate_limited',
    });
    await expect(gate.run('client-b', context, async () => 'ok')).resolves.toBe('ok');

    timestamp += 100;
    await expect(gate.run('client-a', context, async () => 'reset')).resolves.toBe('reset');
  });

  it('bounds client tracking by pruning the oldest idle identities', async () => {
    let timestamp = 1_000;
    const gate = createBffRequestGate({
      rateLimit: 1,
      rateWindowMs: 1_000,
      maxTrackedClients: 2,
      now: () => timestamp,
    });
    const context = createDetachedRequestExecutionContext();

    await gate.run('oldest', context, async () => undefined);
    timestamp += 1;
    await gate.run('newer', context, async () => undefined);
    timestamp += 1;
    await gate.run('newest', context, async () => undefined);

    await expect(gate.run('oldest', context, async () => 'admitted')).resolves.toBe('admitted');
  });
});
