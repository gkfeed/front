import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import { projectReaderItems } from './readerItemsProjection';

const items: FeedItem[] = [
  { id: 1, feedId: 1, link: 'https://example.com/one', title: 'One', text: '' },
  { id: 2, feedId: 1, link: 'https://pornhub.com/video', title: 'NSFW', text: '' },
  { id: 3, feedId: 1, link: 'https://example.com/three', title: 'Three', text: '' },
  { id: 4, feedId: 1, link: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok', text: '' },
];

describe('reader items projection', () => {
  it('orders and filters visible items independently from the review queue', () => {
    const result = projectReaderItems({
      loadedItems: items,
      itemOrder: 'desc',
      nsfwMode: 'hide',
      hideTikTokItems: false,
      deletedItemIds: new Set([3]),
      requeuedItemIds: new Set(),
    });

    expect(result.items?.map(({ id }) => id)).toEqual([4, 1]);
    expect(result.reviewableIds).toEqual([4, 2, 1]);
    expect([...result.visibleItemIds]).toEqual([4, 1]);
  });

  it('moves restored deletions to the end of the review queue', () => {
    const result = projectReaderItems({
      loadedItems: items,
      itemOrder: 'asc',
      nsfwMode: 'show',
      hideTikTokItems: false,
      deletedItemIds: new Set(),
      requeuedItemIds: new Set([2]),
    });

    expect(result.reviewableIds).toEqual([1, 3, 4, 2]);
  });

  it('hides TikTok items from both reader views and the active review queue', () => {
    const result = projectReaderItems({
      loadedItems: items,
      itemOrder: 'asc',
      nsfwMode: 'show',
      hideTikTokItems: true,
      deletedItemIds: new Set(),
      requeuedItemIds: new Set(),
    });

    expect(result.items?.map(({ id }) => id)).toEqual([1, 2, 3]);
    expect([...result.visibleItemIds]).toEqual([1, 2, 3]);
  });
});
