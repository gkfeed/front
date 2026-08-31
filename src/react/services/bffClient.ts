import { DEFAULT_REQUEST_TIMEOUT_MS } from '../platform/requestTimeout';
import { requestJson } from './httpRequest';

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
    readonly reason: 'invalid-json' | 'invalid-shape' = 'invalid-shape',
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
  const requestUrl = `${endpoint}?url=${encodeURIComponent(input)}`;
  const createResponseError = (status: number) => new BffResponseError(
    `Invalid ${resourceName} response`,
    endpoint,
    status,
    'invalid-shape',
  );
  return requestJson<T>(requestUrl, { signal }, {
    timeoutMs,
    createHttpError: (status) => new BffHttpError(
      `${httpErrorName} request failed with ${status}`,
      status,
      endpoint,
    ),
    createTimeoutError: (normalizedTimeoutMs) => new BffTimeoutError(endpoint, normalizedTimeoutMs),
    createInvalidJsonError: (status) => new BffResponseError(
      `Invalid ${resourceName} response`,
      endpoint,
      status,
      'invalid-json',
    ),
    validate,
    createInvalidResponseError: createResponseError,
  });
}
