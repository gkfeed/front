// @vitest-environment jsdom

import { useCallback } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAsyncLoad } from './useAsyncLoad';

describe('useAsyncLoad', () => {
  afterEach(() => vi.useRealTimers());

  it('loads values and retries on demand', async () => {
    const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() => useAsyncLoad(load));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.result).toBe('first'));
    expect(result.current.isLoading).toBe(false);

    act(result.current.retry);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.result).toBe('second'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('ignores stale results after dependencies change', async () => {
    let resolveFirstLoad: (value: string) => void = () => {};
    const load = vi.fn((value: string) => (
      value === 'first'
        ? new Promise<string>((resolve) => {
          resolveFirstLoad = resolve;
        })
        : Promise.resolve(value)
    ));
    const { result, rerender } = renderHook(({ value }) => {
      const loadValue = useCallback(() => load(value), [value]);
      return useAsyncLoad(loadValue);
    }, { initialProps: { value: 'first' } });

    rerender({ value: 'second' });
    await waitFor(() => expect(result.current.result).toBe('second'));

    await act(() => {
      resolveFirstLoad('stale');
    });

    expect(result.current.result).toBe('second');
  });

  it('exposes a discriminated state and turns timeout into a typed error', async () => {
    vi.useFakeTimers();
    const load = vi.fn((signal: AbortSignal) => new Promise<string>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const { result } = renderHook(() => useAsyncLoad(load, { timeoutMs: 50 }));

    expect(result.current.state).toEqual({ status: 'loading', data: undefined, error: null });

    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error?.name).toBe('AsyncLoadTimeoutError');
    expect(result.current.isLoading).toBe(false);
  });
});
