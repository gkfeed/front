import type { FeedInput } from '../types';
import { normalizeHostname } from '../../../shared/urlRules';

export type FeedCreatorMode = 'lazy' | 'extended';

export type FeedCreatorFieldConfig = {
  id: keyof FeedInput;
  labelKey: string;
  type: 'select' | 'text' | 'url';
  placeholderKey?: string;
  errorKey: string;
};

export const EMPTY_FEED: FeedInput = {
  title: '',
  type: 'web',
  url: '',
};

const URL_FIELD: FeedCreatorFieldConfig = {
  id: 'url',
  labelKey: 'creator.url',
  type: 'url',
  errorKey: 'creator.validUrl',
};

export const FEED_CREATOR_FIELDS: Readonly<Record<FeedCreatorMode, readonly FeedCreatorFieldConfig[]>> = {
  lazy: [URL_FIELD],
  extended: [
    { id: 'title', labelKey: 'creator.title', type: 'text', placeholderKey: 'creator.titlePlaceholder', errorKey: 'creator.titleRequired' },
    { id: 'type', labelKey: 'creator.type', type: 'select', errorKey: 'creator.typeRequired' },
    URL_FIELD,
  ],
};

const VALID_URL_PROTOCOLS = new Set(['http:', 'https:']);

export function getFeedCreatorFields(mode: FeedCreatorMode): readonly FeedCreatorFieldConfig[] {
  return FEED_CREATOR_FIELDS[mode];
}

export function isFeedFieldValid(feed: FeedInput, field: keyof FeedInput): boolean {
  const value = feed[field].trim();
  if (!value) return false;

  return field === 'url' ? isValidFeedUrl(value) : true;
}

export function trimFeed(feed: FeedInput): FeedInput {
  return {
    title: feed.title.trim(),
    type: feed.type.trim(),
    url: feed.url.trim(),
  };
}

export function normalizeLazyFeedUrl(value: string): string {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    if (normalizeHostname(url.hostname) === 'youtube.com'
      && /^\/channel\/[^/]+\/?$/.test(url.pathname)) {
      url.search = '';
      url.hash = '';
      return url.href.replace(/\/$/, '');
    }
  } catch {
    // Validation prevents malformed URLs from reaching lazy creation.
  }

  return trimmed;
}

export function inferFeedSourceFromLazyUrl(value: string): Pick<FeedInput, 'type' | 'url'> | null {
  const url = normalizeLazyFeedUrl(value);

  try {
    const parsedUrl = new URL(url);
    if (normalizeHostname(parsedUrl.hostname) !== 'youtube.com') return null;

    const channelId = parsedUrl.pathname.match(/^\/channel\/([^/]+)\/?$/)?.[1];
    return channelId ? { type: 'yt', url } : null;
  } catch {
    return null;
  }
}

function isValidFeedUrl(value: string): boolean {
  try {
    return VALID_URL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
