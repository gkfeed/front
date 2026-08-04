import { describe, expect, it } from 'vitest';

import { filterFeeds } from './feedsListViewModel';

const feeds = [
  { id: 1, title: 'Tech News', type: 'rss', url: 'https://tech.example/feed.xml' },
  { id: 2, title: 'Games', type: 'web', url: 'https://games.example/news' },
];

describe('feeds list view model', () => {
  it('matches title, type, and URL', () => {
    expect(filterFeeds(feeds, 'tech')).toEqual([feeds[0]]);
    expect(filterFeeds(feeds, 'web')).toEqual([feeds[1]]);
    expect(filterFeeds(feeds, 'games.example')).toEqual([feeds[1]]);
  });

  it('returns all feeds for an empty query', () => {
    expect(filterFeeds(feeds, '')).toEqual(feeds);
  });
});
