import { describe, expect, it } from 'vitest';

import { orderReaderItems } from '../../state/readerItemOrder';
import type { FeedItem } from '../../types';

const ITEMS: FeedItem[] = [
  { id: 2, feedId: 1, link: '', title: 'Two', text: '' },
  { id: 1, feedId: 1, link: '', title: 'One', text: '' },
  { id: 3, feedId: 1, link: '', title: 'Three', text: '' },
];

describe('reader item order', () => {
  it('orders items by id without mutating the loaded snapshot', () => {
    expect(orderReaderItems(ITEMS, 'asc').map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(orderReaderItems(ITEMS, 'desc').map(({ id }) => id)).toEqual([3, 2, 1]);
    expect(ITEMS.map(({ id }) => id)).toEqual([2, 1, 3]);
  });
});
