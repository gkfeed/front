import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBffRequestGate } from '../../../server/http/bffRequestGate';
import { clearPreviewCache, loadQueuedPreview, peekQueuedPreview, reprioritizeQueuedPreview } from './previewQueue';

afterEach(() => {
  clearPreviewCache();
  vi.useRealTimers();
});

const expectAbortError = (promise: Promise<unknown>) => (
  expect(promise).rejects.toMatchObject({ name: 'AbortError' })
);

describe('loadQueuedPreview', () => {
  it('deduplicates preview requests by cache key', async () => {
    const load = vi.fn().mockResolvedValue('preview');

    const first = loadQueuedPreview('same-url', load);
    const second = loadQueuedPreview('same-url', load);

    await expect(Promise.all([first, second])).resolves.toEqual(['preview', 'preview']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('runs no more than four preview requests concurrently', async () => {
    const releases: Array<() => void> = [];
    const load = vi.fn(() => new Promise<string>((resolve) => {
      releases.push(() => resolve('preview'));
    }));

    const requests = Array.from(
      { length: 6 },
      (_, index) => loadQueuedPreview(`url-${index}`, load),
    );

    expect(load).toHaveBeenCalledTimes(4);
    releases[0]!();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    releases[1]!();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(6));
    releases.slice(2).forEach((release) => release());

    await expect(Promise.all(requests)).resolves.toEqual(Array(6).fill('preview'));
  });

  it('starts the nearest speculative item even if a distant item was queued first', async () => {
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const load = (name: string) => () => new Promise<string>((resolve) => {
      started.push(name);
      releases.push(() => resolve(name));
    });
    const far = loadQueuedPreview('batched-far', load('far'), undefined, 7);
    const near = loadQueuedPreview('batched-near', load('near'), undefined, 1);
    await vi.waitFor(() => expect(started).toEqual(['near']));
    releases[0]!();
    await vi.waitFor(() => expect(started).toEqual(['near', 'far']));
    releases[1]!();
    await Promise.all([near, far]);
  });

  it('pauses a distant prefetch for a nearer item and later restarts it', async () => {
    const farCalls: Array<{ signal: AbortSignal; resolve: (value: string) => void }> = [];
    let releaseNear!: (value: string) => void;
    const far = loadQueuedPreview('preempt-far', (signal) => new Promise<string>((resolve) => {
      farCalls.push({ signal, resolve });
    }), undefined, 5);
    await vi.waitFor(() => expect(farCalls).toHaveLength(1));
    const near = loadQueuedPreview('preempt-near', () => new Promise<string>((resolve) => {
      releaseNear = resolve;
    }), undefined, 1);
    await vi.waitFor(() => expect(farCalls[0]!.signal.aborted).toBe(true));
    farCalls[0]!.resolve('stale result');
    releaseNear('near result');
    await expect(near).resolves.toBe('near result');
    await vi.waitFor(() => expect(farCalls).toHaveLength(2));
    farCalls[1]!.resolve('fresh result');
    await expect(far).resolves.toBe('fresh result');
  });

  it('releases a BFF slot when a nearer prefetch interrupts a slow one', async () => {
    const gate = createBffRequestGate();
    const started: string[] = [];
    const farReleases: Array<(value: string) => void> = [];
    let releaseNear!: (value: string) => void;
    const context = (signal: AbortSignal) => ({ signal, deadline: Infinity, remainingMs: () => Infinity });
    const far = loadQueuedPreview('bff-preempt-far', (signal) => gate.run('same-client', context(signal),
      () => new Promise<string>((resolve, reject) => {
        started.push('far');
        farReleases.push(resolve);
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      })), undefined, 5);
    await vi.waitFor(() => expect(started).toEqual(['far']));
    const near = loadQueuedPreview('bff-preempt-near', (signal) => gate.run('same-client', context(signal),
      () => new Promise<string>((resolve) => { started.push('near'); releaseNear = resolve; })), undefined, 1);
    await vi.waitFor(() => expect(started).toEqual(['far', 'near']));
    releaseNear('near');
    await expect(near).resolves.toBe('near');
    await vi.waitFor(() => expect(started).toEqual(['far', 'near', 'far']));
    farReleases[1]!('far');
    await expect(far).resolves.toBe('far');
  });

  it('reconsiders an active prefetch when its priority falls behind a queued item', async () => {
    const farSignals: AbortSignal[] = [];
    const farReleases: Array<(value: string) => void> = [];
    let releaseNear!: (value: string) => void;
    const far = loadQueuedPreview('reorder-active', (signal) => new Promise<string>((resolve) => {
      farSignals.push(signal);
      farReleases.push(resolve);
    }), undefined, 1);
    await vi.waitFor(() => expect(farSignals).toHaveLength(1));
    const near = loadQueuedPreview('reorder-near', () => new Promise<string>((resolve) => {
      releaseNear = resolve;
    }), undefined, 2);
    reprioritizeQueuedPreview('reorder-active', 3);
    await vi.waitFor(() => expect(farSignals[0]!.aborted).toBe(true));
    releaseNear('near');
    await expect(near).resolves.toBe('near');
    await vi.waitFor(() => expect(farSignals).toHaveLength(2));
    farReleases[1]!('far');
    await expect(far).resolves.toBe('far');
  });

  it('does not suspend a request that has become visible', async () => {
    let farSignal!: AbortSignal;
    let releaseFar!: (value: string) => void;
    let releaseNear!: (value: string) => void;
    const far = loadQueuedPreview('protected-far', (signal) => new Promise<string>((resolve) => {
      farSignal = signal;
      releaseFar = resolve;
    }), undefined, 5);
    await vi.waitFor(() => expect(farSignal).toBeDefined());
    const visible = loadQueuedPreview('protected-far', () => Promise.resolve('duplicate'));
    const near = loadQueuedPreview('protected-near', () => new Promise<string>((resolve) => {
      releaseNear = resolve;
    }), undefined, 1);
    await vi.waitFor(() => expect(releaseNear).toBeDefined());
    expect(farSignal.aborted).toBe(false);
    releaseFar('far');
    releaseNear('near');
    await expect(Promise.all([far, visible, near])).resolves.toEqual(['far', 'far', 'near']);
  });

  it('lets the visible request enter the BFF while prefetches occupy the queue', async () => {
    const gate = createBffRequestGate();
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const load = (name: string) => (signal: AbortSignal) => gate.run(
      'same-client', { signal, deadline: Infinity, remainingMs: () => Infinity },
      () => new Promise<string>((resolve) => {
        started.push(name);
        releases.push(() => resolve(name));
      }),
    );
    const prefetches = [1, 2, 3].map((index) => (
      loadQueuedPreview(`gate-${index}`, load(`prefetch-${index}`), undefined, index).catch(() => undefined)
    ));
    await vi.waitFor(() => expect(started).toEqual(['prefetch-1']));
    const visible = loadQueuedPreview('gate-visible', load('visible')).catch(() => undefined);
    expect(started).toEqual(['prefetch-1', 'visible']);
    clearPreviewCache();
    releases.forEach((release) => release());
    await Promise.all([...prefetches, visible]);
  });

  it('reserves a slot for the current card when background requests stall', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const background = Array.from({ length: 4 }, (_, index) => (
      loadQueuedPreview(`background-${index}`, load(`background-${index}`), undefined, index + 1)
    ));
    await vi.waitFor(() => expect(started).toEqual(['background-0']));
    const visible = loadQueuedPreview('visible-now', load('visible-now'));
    expect(started).toContain('visible-now');
    expect(started).not.toContain('background-3');
    releases.get('visible-now')!();
    await expect(visible).resolves.toBe('visible-now');
    for (let index = 0; index < 4; index += 1) {
      await vi.waitFor(() => expect(started).toContain(`background-${index}`));
      releases.get(`background-${index}`)!();
    }
    await Promise.all(background);
  });

  it('starts a queued prefetch immediately when it becomes visible', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const background = Array.from({ length: 4 }, (_, index) => (
      loadQueuedPreview(`promote-${index}`, load(`promote-${index}`), undefined, index + 1)
    ));
    await vi.waitFor(() => expect(started).toEqual(['promote-0']));
    const visible = loadQueuedPreview('promote-3', load('duplicate'));
    expect(started).toContain('promote-3');
    expect(started).not.toContain('duplicate');
    releases.get('promote-3')!();
    for (let index = 0; index < 3; index += 1) {
      await vi.waitFor(() => expect(started).toContain(`promote-${index}`));
      releases.get(`promote-${index}`)!();
    }
    await Promise.all([...background, visible]);
  });

  it('promotes a queued prefetch when it becomes the visible card', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const running = Array.from({ length: 4 }, (_, index) => loadQueuedPreview(`running-${index}`, load(`running-${index}`)));
    const distant = loadQueuedPreview('distant', load('distant'), undefined, 8);
    const near = loadQueuedPreview('near', load('near'), undefined, 2);
    const promoted = loadQueuedPreview('distant', load('duplicate'), undefined, 0);
    reprioritizeQueuedPreview('distant', 9);
    releases.get('running-0')!();
    await vi.waitFor(() => expect(started).toContain('distant'));
    expect(started).not.toContain('near');
    releases.get('running-1')!();
    await vi.waitFor(() => expect(started).toContain('near'));
    releases.forEach((release) => release());
    await expect(Promise.all([...running, distant, near, promoted])).resolves.toHaveLength(7);
    expect(started).not.toContain('duplicate');
  });

  it('lowers a shared prefetch after its last visible subscriber aborts', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const running = Array.from({ length: 4 }, (_, index) => loadQueuedPreview(`running-${index}`, load(`running-${index}`)));
    const prefetch = loadQueuedPreview('old', load('old'), undefined, 9);
    const first = new AbortController();
    const second = new AbortController();
    const firstAbort = expectAbortError(loadQueuedPreview('old', load('duplicate'), first.signal));
    const secondAbort = expectAbortError(loadQueuedPreview('old', load('duplicate'), second.signal));
    first.abort();
    const visible = loadQueuedPreview('visible', load('visible'));
    // One visible subscriber still protects the original request.
    releases.get('running-0')!();
    await vi.waitFor(() => expect(started).toContain('old'));
    expect(started).not.toContain('visible');
    second.abort();
    releases.get('running-1')!();
    await vi.waitFor(() => expect(started).toContain('visible'));
    releases.forEach((release) => release());
    await Promise.all([...running, prefetch, visible, firstAbort, secondAbort]);
  });

  it('starts a new visible request ahead of a prefetch after its visible subscriber leaves', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const running = Array.from({ length: 4 }, (_, index) => loadQueuedPreview(`running-${index}`, load(`running-${index}`)));
    const prefetch = loadQueuedPreview('old', load('old'), undefined, 9);
    const controller = new AbortController();
    const aborted = expectAbortError(loadQueuedPreview('old', load('duplicate'), controller.signal));
    controller.abort();
    reprioritizeQueuedPreview('old', 2);
    const visible = loadQueuedPreview('visible', load('visible'));
    releases.get('running-0')!();
    await vi.waitFor(() => expect(started).toContain('visible'));
    expect(started).not.toContain('old');
    releases.get('running-1')!();
    await vi.waitFor(() => expect(started).toContain('old'));
    releases.forEach((release) => release());
    await Promise.all([...running, prefetch, visible, aborted]);
  });

  it('keeps the prefetch priority when a request starts with a visible subscriber', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const running = Array.from({ length: 4 }, (_, index) => loadQueuedPreview(`running-${index}`, load(`running-${index}`)));
    const controller = new AbortController();
    const aborted = expectAbortError(loadQueuedPreview('distant', load('distant'), controller.signal));
    const distant = loadQueuedPreview('distant', load('duplicate'), undefined, 9);
    controller.abort();
    const near = loadQueuedPreview('near', load('near'), undefined, 1);
    releases.get('running-0')!();
    await vi.waitFor(() => expect(started).toContain('near'));
    expect(started).not.toContain('distant');
    releases.get('near')!();
    await vi.waitFor(() => expect(started).toContain('distant'));
    releases.forEach((release) => release());
    await Promise.all([...running, distant, near, aborted]);
  });

  it('does not promote a shared prefetch for an already-aborted visible subscriber', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const running = Array.from({ length: 4 }, (_, index) => loadQueuedPreview(`running-${index}`, load(`running-${index}`)));
    const distant = loadQueuedPreview('distant', load('distant'), undefined, 9);
    const controller = new AbortController();
    controller.abort();
    await expectAbortError(loadQueuedPreview('distant', load('duplicate'), controller.signal));
    const near = loadQueuedPreview('near', load('near'), undefined, 1);
    releases.get('running-0')!();
    await vi.waitFor(() => expect(started).toContain('near'));
    expect(started).not.toContain('distant');
    releases.get('near')!();
    await vi.waitFor(() => expect(started).toContain('distant'));
    releases.forEach((release) => release());
    await Promise.all([...running, distant, near]);
  });

  it('uses the revised order before an aborted request releases a slot', async () => {
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const load = (id: string) => () => new Promise<string>((resolve) => {
      started.push(id);
      releases.set(id, () => resolve(id));
    });
    const controller = new AbortController();
    const running = loadQueuedPreview('running-0', load('running-0'), controller.signal);
    const runningAbort = expectAbortError(running);
    const rest = Array.from({ length: 3 }, (_, index) => loadQueuedPreview(`running-${index + 1}`, load(`running-${index + 1}`)));
    const first = loadQueuedPreview('first', load('first'), undefined, 1);
    const next = loadQueuedPreview('next', load('next'), undefined, 5);
    reprioritizeQueuedPreview('first', 5);
    reprioritizeQueuedPreview('next', 1);
    controller.abort();
    expect(started).toContain('next');
    expect(started).not.toContain('first');
    releases.get('next')!();
    await vi.waitFor(() => expect(started).toContain('first'));
    releases.forEach((release) => release());
    await runningAbort;
    await Promise.all([...rest, first, next]);
  });

  it('does not cancel a shared request while another subscriber remains', async () => {
    const controller = new AbortController();
    let resolveLoad!: (value: string) => void;
    const load = vi.fn((signal: AbortSignal) => new Promise<string>((resolve) => {
      resolveLoad = resolve;
      signal.addEventListener('abort', () => undefined);
    }));

    const first = loadQueuedPreview('shared-url', load, controller.signal);
    const second = loadQueuedPreview('shared-url', load);
    controller.abort();
    resolveLoad('preview');

    await expectAbortError(first);
    await expect(second).resolves.toBe('preview');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0].aborted).toBe(false);
  });

  it('aborts a running request and releases its queue slot when all subscribers leave', async () => {
    const firstController = new AbortController();
    const releases: Array<() => void> = [];
    const signals: AbortSignal[] = [];
    const load = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>((resolve) => releases.push(() => resolve('preview')));
    });

    const first = loadQueuedPreview('abort-url', load, firstController.signal);
    firstController.abort();
    const second = loadQueuedPreview('next-url', load);

    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(signals[0]?.aborted).toBe(true);
    releases[1]!();
    await expectAbortError(first);
    await expect(second).resolves.toBe('preview');
  });

  it('rejects a request whose only subscriber is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const load = vi.fn().mockResolvedValue('preview');

    await expectAbortError(loadQueuedPreview('aborted-url', load, controller.signal));

    expect(load).not.toHaveBeenCalled();
  });

  it('exposes only completed, unexpired data for the first render', async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    const result = loadQueuedPreview('peek-url', () => new Promise<string>((done) => { resolve = done; }));
    expect(peekQueuedPreview('peek-url')).toBeUndefined();
    resolve('ready');
    await result;
    expect(peekQueuedPreview('peek-url')).toEqual({ value: 'ready' });
    vi.advanceTimersByTime(5 * 60_000);
    expect(peekQueuedPreview('peek-url')).toBeUndefined();
  });

  it('expires completed values after the cache TTL', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValue('preview');

    await expect(loadQueuedPreview('ttl-url', load)).resolves.toBe('preview');
    await expect(loadQueuedPreview('ttl-url', load)).resolves.toBe('preview');
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60_000 + 1);
    await expect(loadQueuedPreview('ttl-url', load)).resolves.toBe('preview');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('removes failed requests from the cache and allows a retry', async () => {
    const error = new Error('provider failed');
    const load = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('preview');

    await expect(loadQueuedPreview('error-url', load)).rejects.toBe(error);
    await expect(loadQueuedPreview('error-url', load)).resolves.toBe('preview');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('releases the slot when a loader throws synchronously', async () => {
    const load = vi.fn()
      .mockImplementationOnce(() => { throw new Error('sync failure'); })
      .mockResolvedValueOnce('preview');

    await expect(loadQueuedPreview('sync-error-url', load)).rejects.toThrow('sync failure');
    await expect(loadQueuedPreview('retry-url', load)).resolves.toBe('preview');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not start queued prefetches while clearing active work', async () => {
    const started: string[] = [];
    const load = (id: string) => () => {
      started.push(id);
      return new Promise<string>(() => {});
    };
    const active = loadQueuedPreview('clear-active', load('active'), undefined, 1).catch(() => undefined);
    const waiting = loadQueuedPreview('clear-waiting', load('waiting'), undefined, 2).catch(() => undefined);
    await vi.waitFor(() => expect(started).toEqual(['active']));
    clearPreviewCache();
    await Promise.all([active, waiting]);
    expect(started).toEqual(['active']);
  });

  it('cancels cached requests when the preview cache is cleared', async () => {
    let requestSignal!: AbortSignal;
    const load = vi.fn((signal: AbortSignal) => {
      requestSignal = signal;
      return new Promise<string>(() => undefined);
    });

    const pending = loadQueuedPreview('clear-url', load);
    clearPreviewCache();

    expect(requestSignal.aborted).toBe(true);
    await expectAbortError(pending);
  });
});
