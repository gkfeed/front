import type { FeedInput } from '../types';
import { normalizeHostname } from '../../../shared/urlRules';

export type FeedCreatorMode = 'lazy' | 'extended';

export type FeedTypeDetectionStatus =
  | { state: 'idle' | 'detecting' | 'error' | 'uncertain' }
  | { state: 'success'; confidence: number };

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
    URL_FIELD,
    { id: 'title', labelKey: 'creator.title', type: 'text', placeholderKey: 'creator.titlePlaceholder', errorKey: 'creator.titleRequired' },
    { id: 'type', labelKey: 'creator.type', type: 'select', errorKey: 'creator.typeRequired' },
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

export function inferFeedTitleFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const lastPathSegment = url.pathname.split('/').filter(Boolean).at(-1);
    const rawTitle = lastPathSegment
      ? decodeURIComponent(lastPathSegment).replace(/^@/, '').replace(/\.[a-z0-9]{2,5}$/i, '')
      : normalizeHostname(url.hostname).split('.')[0];
    const title = rawTitle.replace(/[-_]+/g, ' ').trim();
    return title ? title.charAt(0).toUpperCase() + title.slice(1) : null;
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
