import type { Feed, FeedItem } from '../types';
import { getObjectProperty } from '../unknownObject';
import { normalizeExternalText } from '../../../shared/text';

export function parseFeeds(value: unknown): Feed[] {
  if (Array.isArray(value) && value.every(isFeed)) return value;
  throw new Error('Invalid API response');
}

export type FeedItemsPage = {
  items: FeedItem[];
  nextCursor?: number;
};

export function parseFeedItemsPage(value: unknown): FeedItemsPage {
  const rawItems = getObjectProperty(value, 'items');
  const rawNextCursor = getObjectProperty(value, 'next_cursor');
  const items = rawItems === null ? [] : rawItems;
  if (!Array.isArray(items) || !items.every(isFeedItem)) throw new Error('Invalid API response');
  if (
    rawNextCursor !== undefined
    && rawNextCursor !== null
    && (
      typeof rawNextCursor !== 'number'
      || !Number.isSafeInteger(rawNextCursor)
      || rawNextCursor <= 0
    )
  ) {
    throw new Error('Invalid API response');
  }

  return {
    items: items
      .filter((item) => Boolean(item.link))
      .map((item) => ({
        id: item.id,
        feedId: item.feed_id,
        link: item.link,
        title: normalizeExternalText(item.title),
        text: normalizeExternalText(item.text),
      })),
    nextCursor: typeof rawNextCursor === 'number' ? rawNextCursor : undefined,
  };
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

function isFeedItem(value: unknown): value is Record<string, unknown> & {
  id: number;
  feed_id: number;
  link: string;
  title: string;
  text: string;
} {
  const id = getObjectProperty(value, 'id');
  const feedId = getObjectProperty(value, 'feed_id');
  const link = getObjectProperty(value, 'link');
  const title = getObjectProperty(value, 'title');
  const itemText = getObjectProperty(value, 'text');

  return typeof id === 'number'
    && Number.isSafeInteger(id)
    && id > 0
    && typeof feedId === 'number'
    && Number.isSafeInteger(feedId)
    && feedId > 0
    && [link, title, itemText].every((field) => typeof field === 'string');
}
