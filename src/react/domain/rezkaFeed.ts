import type { Feed } from '../types';

export function rezkaTitleId(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['hdrezka.me', 'rezka.ag'].includes(url.hostname.toLowerCase().replace(/^www\./, ''))) return null;
    return /^\/(?:films|series|animation|cartoons)\/[^/]+\/(\d+)-[^/]+\.html$/i.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function findRezkaFeed(feeds: Feed[], url: string): Feed | undefined {
  const id = rezkaTitleId(url);
  return id ? feeds.find((feed) => feed.type === 'rezka' && rezkaTitleId(feed.url) === id) : undefined;
}
