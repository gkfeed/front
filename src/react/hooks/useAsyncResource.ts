import { useCallback, useEffect, useState } from 'react';

import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from '../features/runtime/requestTimeout';

export type AsyncResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export type AsyncResourceState<T> =
  | { status: 'idle'; data: undefined; error: null }
  | { status: 'loading'; data: undefined; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: undefined; error: Error };

export type UseAsyncResourceOptions = {
  enabled?: boolean;
  key?: unknown;
  timeoutMs?: number;
  createTimeoutError?: (timeoutMs: number) => Error;
};

type InternalState<T> = {
  key: unknown;
  state: AsyncResourceState<T>;
};

const createDefaultTimeoutError = (timeoutMs: number): Error => (
  new AsyncResourceTimeoutError(timeoutMs)
);

export function useAsyncResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  {
    enabled = true,
    key,
    timeoutMs,
    createTimeoutError = createDefaultTimeoutError,
  }: UseAsyncResourceOptions = {},
) {
  const [attempt, setAttempt] = useState(0);
  const [internal, setInternal] = useState<InternalState<T>>(() => ({
    key,
    state: getInitialState<T>(enabled),
  }));

  useEffect(() => {
    if (!enabled) {
      setInternal({ key, state: getInitialState<T>(false) });
      return undefined;
    }

    let active = true;
    const requestController = new AbortController();
    const timeout = timeoutMs === undefined ? null : createTimeoutSignal(timeoutMs);
    const signal = timeout
      ? combineAbortSignals(requestController.signal, timeout.signal)
      : requestController.signal;
    const normalizedTimeoutMs = timeoutMs === undefined
      ? DEFAULT_REQUEST_TIMEOUT_MS
      : Number.isFinite(timeoutMs)
        ? Math.max(0, timeoutMs)
        : DEFAULT_REQUEST_TIMEOUT_MS;

    setInternal({ key, state: getInitialState<T>(true) });

    load(signal)
      .then((data) => {
        if (!active || signal.aborted) return;
        setInternal({ key, state: { status: 'success', data, error: null } });
      })
      .catch((nextError: unknown) => {
        if (!active || (isAbortError(nextError) && !timeout?.didTimeout)) return;
        setInternal({
          key,
          state: {
            status: 'error',
            data: undefined,
            error: timeout?.didTimeout
              ? createTimeoutError(normalizedTimeoutMs)
              : toError(nextError),
          },
        });
      })
      .finally(() => timeout?.dispose());

    return () => {
      active = false;
      timeout?.dispose();
      requestController.abort();
    };
  }, [attempt, enabled, key, load, timeoutMs, createTimeoutError]);

  const retry = useCallback(() => {
    if (!enabled) return;
    setInternal({ key, state: getInitialState<T>(true) });
    setAttempt((value) => value + 1);
  }, [enabled, key]);

  const state = Object.is(internal.key, key)
    ? internal.state
    : getInitialState<T>(enabled);
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

export class AsyncResourceTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Async resource timed out after ${timeoutMs}ms`);
    this.name = 'AsyncResourceTimeoutError';
  }
}

function getInitialState<T>(enabled: boolean): AsyncResourceState<T> {
  return enabled
    ? { status: 'loading', data: undefined, error: null }
    : { status: 'idle', data: undefined, error: null };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
