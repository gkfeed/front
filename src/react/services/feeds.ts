import type { Credentials, Feed, FeedInput, FeedLazyInput } from '../types';
import { getObjectProperty } from '../unknownObject';

const DEFAULT_API_ROOT = import.meta.env.DEV
  ? '/api/v1'
  : 'https://feed.gws.freemyip.com/api/v1';
const API_ROOT = `${(import.meta.env.VITE_API_ROOT || DEFAULT_API_ROOT).replace(/\/+$/, '')}/`;

const endpoint = (path: string) => `${API_ROOT}${path}`;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function isFeed(value: unknown): value is Feed {
  const id = getObjectProperty(value, 'id');
  const title = getObjectProperty(value, 'title');
  const type = getObjectProperty(value, 'type');
  const url = getObjectProperty(value, 'url');

  return typeof id === 'number'
    && Number.isSafeInteger(id)
    && id > 0
    && [title, type, url].every((field) => typeof field === 'string');
}

function parseFeed(value: unknown): Feed {
  if (isFeed(value)) return value;
  throw new Error('Invalid API response');
}

function parseFeeds(value: unknown): Feed[] {
  if (Array.isArray(value) && value.every(isFeed)) return value;
  throw new Error('Invalid API response');
}

function authorization(credentials: Credentials): Record<string, string> {
  const bytes = new TextEncoder().encode(`${credentials.username}:${credentials.password}`);
  return { Authorization: `Basic ${btoa(String.fromCharCode(...bytes))}` };
}

function requireCredentials(credentials: Credentials | null): Credentials {
  if (credentials) return credentials;

  throw new ApiError('Login required', 401);
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { signal: AbortSignal.timeout(10_000), ...init });
  if (!response.ok) {
    throw new ApiError(`Request failed with ${response.status}`, response.status);
  }
  return response;
}

async function requestJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  return (await request(input, init)).json();
}

async function postJson(path: string, body: FeedInput | FeedLazyInput, credentials: Credentials | null): Promise<void> {
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

export async function getAllFeeds(credentials: Credentials | null): Promise<Feed[]> {
  const response = await requestJson(endpoint('list'), {
    headers: authorization(requireCredentials(credentials)),
  });
  return parseFeeds(response);
}

export async function validateCredentials(credentials: Credentials): Promise<void> {
  await getAllFeeds(credentials);
}

export async function getFeedById(id: number, credentials: Credentials | null): Promise<Feed | undefined> {
  return (await getAllFeeds(credentials)).find((feed) => feed.id === id);
}

export async function deleteFeedById(id: number, credentials: Credentials | null): Promise<Feed> {
  const response = await requestJson(endpoint(`feeds/${id}`), {
    method: 'DELETE',
    headers: authorization(requireCredentials(credentials)),
  });
  return parseFeed(response);
}

export async function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<void> {
  await postJson('add', feed, credentials);
}

export async function createFeedFromUrl(feed: FeedLazyInput, credentials: Credentials | null): Promise<void> {
  await postJson('add_lazy', feed, credentials);
}
