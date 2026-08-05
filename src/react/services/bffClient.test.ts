import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BffHttpError,
  BffResponseError,
  requestBffJson,
} from './bffClient';

afterEach(() => vi.unstubAllGlobals());

const request = (options: Partial<Parameters<typeof requestBffJson<string>>[0]> = {}) => requestBffJson({
  endpoint: '/bff/test',
  input: 'https://example.com/story?a=1&b=2',
  resourceName: 'test response',
  validate: (value: unknown): value is string => typeof value === 'string',
  ...options,
});

describe('requestBffJson', () => {
  it('handles HTTP errors consistently and keeps the status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(request()).rejects.toMatchObject({
      name: 'BffHttpError',
      status: 503,
      message: 'test response request failed with 503',
    } satisfies Partial<BffHttpError>);
  });

  it('rejects malformed JSON and invalid JSON shapes consistently', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{', { status: 200 }))
      .mockResolvedValueOnce(Response.json({ value: 42 })));

    await expect(request()).rejects.toBeInstanceOf(BffResponseError);
    await expect(request()).rejects.toMatchObject({
      name: 'BffResponseError',
      message: 'Invalid test response response',
    });
  });

  it('passes caller abort through without converting it to a timeout', async () => {
    const controller = new AbortController();
    let rejectFetch: (error: unknown) => void = () => {};
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_input: string, init: RequestInit) => (
      new Promise<never>((_resolve, reject) => {
        rejectFetch = reject;
        init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    )));

    const pending = request({ signal: controller.signal });
    controller.abort();
    rejectFetch(new DOMException('Aborted', 'AbortError'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
