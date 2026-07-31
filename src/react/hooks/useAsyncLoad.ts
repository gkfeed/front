import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from '../services/requestTimeout';

export type AsyncLoadStatus = 'loading' | 'success' | 'error';

export type AsyncLoadState<T> =
  | { status: 'loading'; data: undefined; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: undefined; error: Error };

export type UseAsyncLoadOptions = {
  timeoutMs?: number;
};

export class AsyncLoadTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Async load timed out after ${timeoutMs}ms`);
    this.name = 'AsyncLoadTimeoutError';
  }
}

export function useAsyncLoad<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS }: UseAsyncLoadOptions = {},
) {
  const [state, setState] = useState<AsyncLoadState<T>>({
    status: 'loading',
    data: undefined,
    error: null,
  });
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    let didTimeout = false;
    const controller = new AbortController();
    const normalizedTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : DEFAULT_REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => {
      if (!isActive) return;
      didTimeout = true;
      setState({
        status: 'error',
        data: undefined,
        error: new AsyncLoadTimeoutError(normalizedTimeoutMs),
      });
      controller.abort();
    }, normalizedTimeoutMs);

    setState({ status: 'loading', data: undefined, error: null });

    load(controller.signal)
      .then((data) => {
        if (!isActive || controller.signal.aborted) return;
        setState({ status: 'success', data, error: null });
      })
      .catch((nextError: unknown) => {
        if (!isActive || isAbortError(nextError) && !didTimeout) return;
        setState({
          status: 'error',
          data: undefined,
          error: didTimeout ? new AsyncLoadTimeoutError(normalizedTimeoutMs) : toError(nextError),
        });
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [load, loadAttempt, timeoutMs]);

  const retry = useCallback(() => setLoadAttempt((value) => value + 1), []);
  const result = state.status === 'success' ? state.data : undefined;
  const error = state.status === 'error' ? state.error : null;

  return {
    state,
    status: state.status,
    result,
    data: result,
    error,
    isLoading: state.status === 'loading',
    retry,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
