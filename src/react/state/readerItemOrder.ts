import type { FeedItem } from '../types';

export type ReaderItemOrder = 'asc' | 'desc';

export const READER_ITEM_ORDER_STORAGE_KEY = 'gkfeed.readerItemOrder';

export function orderReaderItems(items: FeedItem[], order: ReaderItemOrder): FeedItem[] {
  return [...items].sort((left, right) => {
    if (left.id === right.id) return 0;
    return order === 'asc'
      ? (left.id < right.id ? -1 : 1)
      : (left.id > right.id ? -1 : 1);
  });
}
