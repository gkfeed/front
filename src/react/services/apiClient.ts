import { DEFAULT_REQUEST_TIMEOUT_MS } from '../platform/requestTimeout';
import {
  requestJson as requestJsonTransport,
  requestResponse,
  type HttpRequestOptions,
} from './httpRequest';

const DEFAULT_API_ROOT = import.meta.env.DEV
  ? '/api/v1'
  : 'https://feed.gws.freemyip.com/api/v1';
const API_ROOT = `${(import.meta.env.VITE_API_ROOT || DEFAULT_API_ROOT).replace(/\/+$/, '')}/`;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'ApiTimeoutError';
  }
}

export const endpoint = (path: string): string => `${API_ROOT}${path}`;

export function authorization(credentials: { username: string; password: string }): Record<string, string> {
  const bytes = new TextEncoder().encode(`${credentials.username}:${credentials.password}`);
  return { Authorization: `Basic ${btoa(String.fromCharCode(...bytes))}` };
}

export function requireCredentials<T extends { username: string; password: string }>(
  credentials: T | null,
): T {
  if (credentials) return credentials;
  throw new ApiError('Login required', 401);
}

const apiRequestOptions: HttpRequestOptions = {
  timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  createHttpError: (status) => new ApiError(`Request failed with ${status}`, status),
  createTimeoutError: (timeoutMs) => new ApiTimeoutError(timeoutMs),
};

export type ApiRequestOptions = {
  timeoutMs?: number | null;
};

export async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return requestResponse(input, init, apiRequestOptions);
}

export async function requestJson(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: ApiRequestOptions = {},
): Promise<unknown> {
  return requestJsonTransport(input, init, {
    ...apiRequestOptions,
    ...options,
  });
}

export async function postJson(
  path: string,
  body: unknown,
  credentials: { username: string; password: string } | null,
): Promise<void> {
  const authCredentials = requireCredentials(credentials);
  await request(endpoint(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authorization(authCredentials),
    },
    body: JSON.stringify(body),
  });
}
