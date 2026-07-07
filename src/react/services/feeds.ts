import type { Credentials, Feed, FeedInput } from '../types';

const API_ROOT = `${(import.meta.env.VITE_API_ROOT ?? 'https://feed.gws.freemyip.com/api/v1').replace(/\/+$/, '')}/`;

const endpoint = (path: string) => `${API_ROOT}${path}`;

function isFeed(value: unknown): value is Feed {
  if (!value || typeof value !== 'object') return false;
  const { id, title, type, url } = value as Partial<Feed>;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && [title, type, url].every((field) => typeof field === 'string');
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

  throw Object.assign(new Error('Login required'), { status: 401 });
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { signal: AbortSignal.timeout(10_000), ...init });
  if (!response.ok) {
    throw Object.assign(new Error(`Request failed with ${response.status}`), { status: response.status });
  }
  return response;
}

async function requestJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  return (await request(input, init)).json();
}

export async function getAllFeeds(credentials: Credentials | null): Promise<Feed[]> {
  return requestJson(endpoint('list'), { headers: authorization(requireCredentials(credentials)) }).then(parseFeeds);
}

export async function getFeedById(id: number, credentials: Credentials | null): Promise<Feed | undefined> {
  return (await getAllFeeds(credentials)).find((feed) => feed.id === id);
}

export async function deleteFeedById(id: number, credentials: Credentials | null): Promise<Feed> {
  return requestJson(`${endpoint('delete')}?id=${id}`, { headers: authorization(requireCredentials(credentials)) }).then(parseFeed);
}

export async function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<void> {
  const authCredentials = requireCredentials(credentials);

  await request(endpoint('add'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authorization(authCredentials),
    },
    body: JSON.stringify(feed),
  });
}
