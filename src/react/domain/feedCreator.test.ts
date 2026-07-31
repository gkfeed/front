import { describe, expect, it } from 'vitest';

import {
  EMPTY_FEED,
  getFeedCreatorFields,
  isFeedFieldValid,
  trimFeed,
} from './feedCreator';

describe('feed creator domain', () => {
  it('configures URL-only and manual fields independently', () => {
    expect(getFeedCreatorFields('lazy').map((field) => field.id)).toEqual(['url']);
    expect(getFeedCreatorFields('extended').map((field) => field.id)).toEqual(['title', 'type', 'url']);
  });

  it('validates required fields and only accepts HTTP(S) feed URLs', () => {
    expect(isFeedFieldValid(EMPTY_FEED, 'title')).toBe(false);
    expect(isFeedFieldValid({ ...EMPTY_FEED, title: 'News' }, 'title')).toBe(true);
    expect(isFeedFieldValid({ ...EMPTY_FEED, url: 'https://example.com/feed.xml' }, 'url')).toBe(true);
    expect(isFeedFieldValid({ ...EMPTY_FEED, url: 'ftp://example.com/feed.xml' }, 'url')).toBe(false);
    expect(isFeedFieldValid({ ...EMPTY_FEED, url: 'javascript:alert(1)' }, 'url')).toBe(false);
  });

  it('trims values before the manual create request', () => {
    expect(trimFeed({ title: '  News ', type: ' yt ', url: ' https://example.com ' })).toEqual({
      title: 'News',
      type: 'yt',
      url: 'https://example.com',
    });
  });
});
