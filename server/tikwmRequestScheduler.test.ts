import { describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { createTikwmRequestScheduler } from './tikwmRequestScheduler.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';

describe('TikWM request scheduling', () => {
  it('spaces concurrent playback and comments requests without waiting for their responses', async () => {
    const schedule = createTikwmRequestScheduler();
    const starts: number[] = [];
    const start = Date.now();
    const requests = [0, 1, 2].map(() => schedule().then(() => starts.push(Date.now() - start)));
    await Promise.all(requests);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1000);
  });

  it('skips cancelled requests and lets the next request use their slot', async () => {
    const schedule = createTikwmRequestScheduler();
    await schedule();
    const controller = new AbortController();
    const cancelled = schedule(context(controller));
    const rejected = expect(cancelled).rejects.toMatchObject({ reason: 'aborted' });
    const next = schedule();
    await delay(100);
    controller.abort();
    await rejected;
    await next;
  });

  it('honors a request deadline while queued and does not poison the queue', async () => {
    const schedule = createTikwmRequestScheduler();
    await schedule();
    const expired = schedule(context(new AbortController(), Date.now() + 500));
    await expect(expired).rejects.toMatchObject({ reason: 'timeout' });
    const next = schedule();
    await next;
  });
});

function context(controller: AbortController, deadline = Infinity): RequestExecutionContext {
  return { signal: controller.signal, deadline, remainingMs: () => deadline - Date.now() };
}
