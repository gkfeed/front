import { afterEach, describe, expect, it, vi } from 'vitest';

import { BffHttpError } from './bffClient';
import { retryRateLimitedPreview } from './retryRateLimitedPreview';

afterEach(() => vi.useRealTimers());

describe('retryRateLimitedPreview', () => {
  it('stops retrying when the card is skipped', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const load = vi.fn().mockRejectedValue(new BffHttpError('Busy', 429, '/bff/open-graph'));
    const result = retryRateLimitedPreview(load, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await assertion;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds retries even if the server keeps rejecting requests', async () => {
    vi.useFakeTimers();
    const error = new BffHttpError('Busy', 429, '/bff/open-graph');
    const load = vi.fn().mockRejectedValue(error);
    const result = retryRateLimitedPreview(load, new AbortController().signal);
    const assertion = expect(result).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(63_000);
    await assertion;
    expect(load).toHaveBeenCalledTimes(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not retry permanent errors', async () => {
    const error = new BffHttpError('Unsupported', 422, '/bff/open-graph');
    const load = vi.fn().mockRejectedValue(error);
    await expect(retryRateLimitedPreview(load, new AbortController().signal)).rejects.toBe(error);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
