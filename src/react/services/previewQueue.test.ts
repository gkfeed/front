import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearPreviewCache, loadQueuedPreview, reprioritizeQueuedPreview } from './previewQueue';

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
    releases.get('running-1')!();
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
    releases.get('running-1')!();
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
