import { API_ROOT } from '../config';
import { getAuthorizationHeader } from './auth';
import type { Credentials, Feed } from '../types';

let feedCache: Feed[] = [];

function endpoint(path: string): string {
  return `${API_ROOT}${path}`;
}

function requestOptions(credentials: Credentials | null): RequestInit {
  const authorization = getAuthorizationHeader(credentials);
  return authorization ? { headers: { Authorization: authorization } } : {};
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw Object.assign(new Error(`Request failed with ${response.status}`), { status: response.status });
  }
  return response.json() as Promise<T>;
}

export async function getAllFeeds(credentials: Credentials | null): Promise<Feed[]> {
  const feeds = await requestJson<Feed[]>(endpoint('list'), requestOptions(credentials));
  feedCache = feeds;
  return feeds;
}

export async function getFeedById(id: number, credentials: Credentials | null): Promise<Feed | undefined> {
  const cachedFeed = feedCache.find((feed) => feed.id === id);
  if (cachedFeed) return cachedFeed;

  const feeds = await getAllFeeds(credentials);
  return feeds.find((feed) => feed.id === id);
}

export async function deleteFeedById(id: number, credentials: Credentials | null): Promise<Feed> {
  const params = new URLSearchParams({ id: String(id) });
  const deletedFeed = await requestJson<Feed>(`${endpoint('delete')}?${params}`, requestOptions(credentials));
  feedCache = feedCache.filter((feed) => feed.id !== id);
  return deletedFeed;
}

export async function createFeed(feed: Feed, credentials: Credentials | null): Promise<Feed> {
  const createdFeed = await requestJson<Feed>(endpoint('add'), {
    ...requestOptions(credentials),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(requestOptions(credentials).headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(feed),
  });
  feedCache = [...feedCache, createdFeed];
  return createdFeed;
}
