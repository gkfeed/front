import type { Feed, FeedItem } from '../types';
import type { ItemChangesPage } from '../domain/itemSync';
import { getObjectProperty } from '../unknownObject';
import { normalizeExternalText } from '../../../shared/text';
import { normalizeVkWallPostUrl } from '../../../shared/urlRules';
import { normalizeShikimoriAnimeUrl } from '../domain/shikimoriPreview';

export function parseFeeds(value: unknown): Feed[] {
  if (Array.isArray(value) && value.every(isFeed)) return value;
  throw new Error('Invalid API response');
}

export type ItemsSyncPage = {
  items: FeedItem[];
  nextCursor: string;
  hasMore: boolean;
  syncCursor: string;
};

export function parseItemsSyncPage(value: unknown): ItemsSyncPage {
  const items = getObjectProperty(value, 'items');
  const nextCursor = getObjectProperty(value, 'next_cursor');
  const syncCursor = getObjectProperty(value, 'sync_cursor');
  const hasMore = getObjectProperty(value, 'has_more');
  if (!Array.isArray(items) || !items.every(isFeedItem)
    || typeof nextCursor !== 'string' || typeof syncCursor !== 'string' || !syncCursor
    || typeof hasMore !== 'boolean' || (hasMore && !nextCursor)) {
    throw new Error('Invalid API response');
  }
  return { items: normalizeItems(items), nextCursor, syncCursor, hasMore };
}

export function parseItemChangesPage(value: unknown): ItemChangesPage {
  const upserted = getObjectProperty(value, 'upserted');
  const deletedIds = getObjectProperty(value, 'deleted_ids');
  const nextCursor = getObjectProperty(value, 'next_cursor');
  const hasMore = getObjectProperty(value, 'has_more');
  if (!Array.isArray(upserted) || !upserted.every(isFeedItem)
    || !Array.isArray(deletedIds) || !deletedIds.every((id) => Number.isSafeInteger(id) && id > 0)
    || typeof nextCursor !== 'string' || !nextCursor || typeof hasMore !== 'boolean') {
    throw new Error('Invalid API response');
  }
  return {
    upserted: normalizeItems(upserted),
    deletedIds: [...deletedIds, ...upserted.filter((item) => !item.link).map((item) => item.id)],
    nextCursor,
    hasMore,
  };
}

function normalizeItems(items: Array<{ id: number; feed_id: number; link: string; title: string; text: string }>): FeedItem[] {
  return items
    .filter((item) => Boolean(item.link))
    .map((item) => ({
      id: item.id,
      feedId: item.feed_id,
      link: normalizeVkWallPostUrl(normalizeShikimoriAnimeUrl(item.link)),
      title: normalizeExternalText(item.title),
      text: normalizeExternalText(item.text),
    }));
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
