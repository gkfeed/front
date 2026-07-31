import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearPreviewCache, loadQueuedPreview } from './previewQueue';

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
