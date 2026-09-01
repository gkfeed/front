import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import {
  changeFeedPriority,
  orderFeedItems,
  parseFeedPriorities,
} from './feedPriority';

describe('feed priority', () => {
  it('orders feeds and their items by feed id priority', () => {
    const items: FeedItem[] = [
      { id: 30, feedId: 2, link: '', title: 'Newest low', text: '' },
      { id: 20, feedId: 1, link: '', title: 'Normal', text: '' },
      { id: 10, feedId: 3, link: '', title: 'Oldest high', text: '' },
    ];
    const priorities = { 2: -1, 3: 1 };

    expect(orderFeedItems(items, 'desc', priorities).map(({ id }) => id)).toEqual([10, 20, 30]);
  });

  it('keeps the selected item order inside equal-priority groups', () => {
    const items: FeedItem[] = [
      { id: 1, feedId: 1, link: '', title: 'One', text: '' },
      { id: 3, feedId: 2, link: '', title: 'Three', text: '' },
      { id: 2, feedId: 1, link: '', title: 'Two', text: '' },
    ];

    expect(orderFeedItems(items, 'asc', {}).map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(orderFeedItems(items, 'desc', {}).map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('changes and validates the persisted feed-id map', () => {
    expect(changeFeedPriority({}, 42, 1)).toEqual({ 42: 1 });
    expect(changeFeedPriority({ 42: 1 }, 42, -1)).toEqual({});
    expect(parseFeedPriorities({ 42: -2, nope: 3, 7: 100, 8: 0 })).toEqual({ 42: -2 });
  });
});
