// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useAsyncLoad } from './useAsyncLoad';

describe('useAsyncLoad', () => {
  it('loads values and retries on demand', async () => {
    const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() => useAsyncLoad(load, []));

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
    const { result, rerender } = renderHook(({ value }) => (
      useAsyncLoad(() => load(value), [value])
    ), { initialProps: { value: 'first' } });

    rerender({ value: 'second' });
    await waitFor(() => expect(result.current.result).toBe('second'));

    await act(() => {
      resolveFirstLoad('stale');
    });

    expect(result.current.result).toBe('second');
  });
});
