import { describe, expect, it } from 'vitest';

import type { Feed } from '../types';
import { getFeedIcon } from './feedIcons';

const baseFeed: Feed = {
  id: 1,
  title: 'Source',
  type: 'web',
  url: 'https://example.com',
};

describe('getFeedIcon', () => {
  it('matches known feed types and aliases', () => {
    expect(getFeedIcon({ ...baseFeed, type: 'yt' }).label).toBe('YouTube feed type');
    expect(getFeedIcon({ ...baseFeed, type: 'twitter' }).label).toBe('X feed type');
    expect(getFeedIcon({ ...baseFeed, type: 'rss-custom' }).label).toBe('RSS feed type');
  });

  it('falls back to known URL hosts', () => {
    expect(getFeedIcon({ ...baseFeed, type: 'unknown', url: 'https://youtu.be/channel' }).label).toBe('YouTube feed type');
    expect(getFeedIcon({ ...baseFeed, type: 'unknown', url: 'https://instagram.com/example' }).label).toBe('Instagram feed type');
    expect(getFeedIcon({ ...baseFeed, type: 'unknown', url: 'https://tiktok.com/@example' }).label).toBe('Short video feed type');
  });
});
