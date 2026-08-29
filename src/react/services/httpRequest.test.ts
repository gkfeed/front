import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJson, requestResponse, type HttpRequestOptions } from './httpRequest';

const options: HttpRequestOptions = {
  timeoutMs: 50,
  createHttpError: (status) => new Error(`HTTP ${status}`),
  createTimeoutError: (timeoutMs) => new Error(`Timeout ${timeoutMs}`),
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('http request transport', () => {
  it('keeps a request alive when its timeout is explicitly disabled', async () => {
    vi.useFakeTimers();
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    })));

    const pending = requestJson('/slow', {}, { ...options, timeoutMs: null });
    await vi.advanceTimersByTimeAsync(60_000);
    resolveFetch?.(Response.json({ ok: true }));

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('shares HTTP status handling for response and JSON requests', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 })));

    await expect(requestResponse('/status', {}, options)).rejects.toThrow('HTTP 503');
    await expect(requestJson('/status', {}, options)).rejects.toThrow('HTTP 503');
  });

  it('validates JSON through the same request lifecycle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ value: 42 })));

    await expect(requestJson('/value', {}, {
      ...options,
      validate: (value): value is { value: string } => {
        if (!value || typeof value !== 'object' || !('value' in value)) return false;
        return typeof value.value === 'string';
      },
      createInvalidResponseError: () => new Error('Invalid shape'),
    })).rejects.toThrow('Invalid shape');
  });

  it('preserves caller abort errors', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_input: RequestInfo | URL, init: RequestInit) => (
      new Promise<never>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })
    )));

    const pending = requestJson('/abort', { signal: controller.signal }, options);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('converts timeout aborts into the configured typed error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_input: RequestInfo | URL, init: RequestInit) => (
      new Promise<never>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })
    )));

    const pending = requestJson('/timeout', {}, options);
    const rejection = expect(pending).rejects.toThrow('Timeout 50');
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
  });
});
