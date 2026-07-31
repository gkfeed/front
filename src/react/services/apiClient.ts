import {
  combineAbortSignals,
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
  isAbortError,
} from './requestTimeout';

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

export async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const timeout = createTimeoutSignal(DEFAULT_REQUEST_TIMEOUT_MS);
  const signal = combineAbortSignals(init.signal, timeout.signal);
  try {
    const response = await fetch(input, { ...init, signal });
    if (!response.ok) {
      throw new ApiError(`Request failed with ${response.status}`, response.status);
    }
    return response;
  } catch (error: unknown) {
    if (timeout.didTimeout && isAbortError(error)) {
      throw new ApiTimeoutError(DEFAULT_REQUEST_TIMEOUT_MS);
    }
    throw error;
  } finally {
    timeout.dispose();
  }
}

export async function requestJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  return (await request(input, init)).json();
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
