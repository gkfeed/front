import { describe, expect, it } from 'vitest';

import {
  EMPTY_FEED,
  getFeedCreatorFields,
  inferFeedSourceFromLazyUrl,
  isFeedFieldValid,
  normalizeLazyFeedUrl,
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

  it('removes share parameters from YouTube channel URLs before lazy creation', () => {
    expect(normalizeLazyFeedUrl(
      ' https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ?si=9ox1NKEtHJ6v3YRg ',
    )).toBe('https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ');
    expect(inferFeedSourceFromLazyUrl(
      'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ?si=9ox1NKEtHJ6v3YRg',
    )).toEqual({
      type: 'yt',
      url: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ',
    });
  });

  it('leaves non-channel lazy feed URLs unchanged', () => {
    expect(normalizeLazyFeedUrl(' https://example.com/feed.xml?token=value '))
      .toBe('https://example.com/feed.xml?token=value');
    expect(normalizeLazyFeedUrl('https://youtube.com/watch?v=video&si=share'))
      .toBe('https://youtube.com/watch?v=video&si=share');
    expect(inferFeedSourceFromLazyUrl('https://youtube.com/watch?v=video&si=share')).toBeNull();
  });
});
