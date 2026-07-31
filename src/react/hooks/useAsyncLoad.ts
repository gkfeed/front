import { useAsyncResource } from './useAsyncResource';

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

const createAsyncLoadTimeoutError = (timeoutMs: number): Error => (
  new AsyncLoadTimeoutError(timeoutMs)
);

export function useAsyncLoad<T>(
  load: (signal: AbortSignal) => Promise<T>,
  { timeoutMs }: UseAsyncLoadOptions = {},
) {
  const resource = useAsyncResource<T>(load, {
    timeoutMs,
    createTimeoutError: createAsyncLoadTimeoutError,
  });
  const state = resource.state.status === 'idle'
    ? { status: 'loading', data: undefined, error: null } as const
    : resource.state;

  return {
    ...resource,
    state,
    status: state.status,
    isLoading: state.status === 'loading',
  };
}
