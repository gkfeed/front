import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from './requestTimeout';

export type HttpRequestOptions = {
  timeoutMs?: number;
  createHttpError: (status: number) => Error;
  createTimeoutError: (timeoutMs: number) => Error;
  createInvalidJsonError?: (status: number) => Error;
  validate?: (value: unknown) => boolean;
  createInvalidResponseError?: (status: number) => Error;
};

export async function requestResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  options: HttpRequestOptions,
): Promise<Response> {
  return runRequest(
    (signal) => fetch(input, { ...init, signal }).then((response) => {
      if (!response.ok) throw options.createHttpError(response.status);
      return response;
    }),
    init.signal,
    options,
  );
}

export async function requestJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: HttpRequestOptions,
): Promise<T> {
  return runRequest(async (signal) => {
    const response = await fetch(input, { ...init, signal });
    if (!response.ok) throw options.createHttpError(response.status);

    let value: T;
    try {
      value = await response.json() as T;
    } catch (error: unknown) {
      if (isAbortError(error)) throw error;
      if (options.createInvalidJsonError) {
        throw options.createInvalidJsonError(response.status);
      }
      throw error;
    }
    if (options.validate && !options.validate(value)) {
      throw options.createInvalidResponseError?.(response.status)
        ?? new Error('Invalid JSON response');
    }
    return value;
  }, init.signal, options);
}

async function runRequest<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  callerSignal: AbortSignal | null | undefined,
  {
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    createTimeoutError,
  }: HttpRequestOptions,
): Promise<T> {
  const timeout = createTimeoutSignal(timeoutMs);
  const signal = combineAbortSignals(callerSignal, timeout.signal);
  const normalizedTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.max(0, timeoutMs)
    : DEFAULT_REQUEST_TIMEOUT_MS;

  try {
    return await operation(signal);
  } catch (error: unknown) {
    if (timeout.didTimeout && isAbortError(error)) {
      throw createTimeoutError(normalizedTimeoutMs);
    }
    throw error;
  } finally {
    timeout.dispose();
  }
}
