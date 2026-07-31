import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from './requestTimeout';

export const BFF_REQUEST_TIMEOUT_MS = DEFAULT_REQUEST_TIMEOUT_MS;

export class BffHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = 'BffHttpError';
  }
}

export class BffResponseError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BffResponseError';
  }
}

export class BffTimeoutError extends Error {
  constructor(
    readonly endpoint: string,
    readonly timeoutMs: number,
  ) {
    super(`BFF request timed out after ${timeoutMs}ms`);
    this.name = 'BffTimeoutError';
  }
}

type BffJsonRequest<T> = {
  endpoint: string;
  input: string;
  resourceName: string;
  httpErrorName?: string;
  validate: (value: unknown) => value is T;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export async function requestBffJson<T>({
  endpoint,
  input,
  resourceName,
  httpErrorName = resourceName,
  validate,
  signal,
  timeoutMs = BFF_REQUEST_TIMEOUT_MS,
}: BffJsonRequest<T>): Promise<T> {
  const timeout = createTimeoutSignal(timeoutMs);
  const requestSignal = combineAbortSignals(signal, timeout.signal);
  const requestUrl = `${endpoint}?url=${encodeURIComponent(input)}`;

  try {
    const response = await fetch(requestUrl, { signal: requestSignal });
    if (!response.ok) {
      throw new BffHttpError(
        `${httpErrorName} request failed with ${response.status}`,
        response.status,
        endpoint,
      );
    }

    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new BffResponseError(`Invalid ${resourceName} response`, endpoint, response.status);
    }

    if (!validate(value)) {
      throw new BffResponseError(`Invalid ${resourceName} response`, endpoint, response.status);
    }
    return value;
  } catch (error: unknown) {
    if (timeout.didTimeout && isAbortError(error)) {
      throw new BffTimeoutError(endpoint, timeoutMs);
    }
    throw error;
  } finally {
    timeout.dispose();
  }
}
