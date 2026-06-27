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

function authorization(credentials: Credentials | null): Record<string, string> {
  if (!credentials) return {};
  const bytes = new TextEncoder().encode(`${credentials.username}:${credentials.password}`);
  return { Authorization: `Basic ${btoa(String.fromCharCode(...bytes))}` };
}

async function requestJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(input, { signal: AbortSignal.timeout(10_000), ...init });
  if (!response.ok) {
    throw Object.assign(new Error(`Request failed with ${response.status}`), { status: response.status });
  }
  return response.json();
}

export function getAllFeeds(credentials: Credentials | null): Promise<Feed[]> {
  return requestJson(endpoint('list'), { headers: authorization(credentials) }).then(parseFeeds);
}

export async function getFeedById(id: number, credentials: Credentials | null): Promise<Feed | undefined> {
  return (await getAllFeeds(credentials)).find((feed) => feed.id === id);
}

export function deleteFeedById(id: number, credentials: Credentials | null): Promise<Feed> {
  return requestJson(`${endpoint('delete')}?id=${id}`, { headers: authorization(credentials) }).then(parseFeed);
}

export function createFeed(feed: FeedInput, credentials: Credentials | null): Promise<Feed> {
  return requestJson(endpoint('add'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authorization(credentials),
    },
    body: JSON.stringify(feed),
  }).then(parseFeed);
}
