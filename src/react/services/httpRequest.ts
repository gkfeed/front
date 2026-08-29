import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from './requestTimeout';

export type HttpRequestOptions = {
  timeoutMs?: number | null;
  createHttpError: (status: number) => Error;
  createTimeoutError: (timeoutMs: number) => Error;
  createInvalidJsonError?: (status: number) => Error;
  validate?: (value: unknown) => boolean;
  createInvalidResponseError?: (status: number) => Error;
};

export function requestResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  options: HttpRequestOptions,
): Promise<Response> {
  return requestTransport(
    input,
    init,
    options,
    (response) => response,
  );
}

export function requestJson<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: HttpRequestOptions,
): Promise<T> {
  return requestTransport(
    input,
    init,
    options,
    async (response) => {
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
    },
  );
}

async function requestTransport<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: HttpRequestOptions,
  parse: (response: Response) => Promise<T> | T,
): Promise<T> {
  return runRequest(async (signal) => {
    const response = await fetch(input, { ...init, signal });
    if (!response.ok) throw options.createHttpError(response.status);
    return parse(response);
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
  if (timeoutMs === null) {
    return operation(callerSignal ?? new AbortController().signal);
  }

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
