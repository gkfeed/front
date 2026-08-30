import { isNsfwLink } from '../domain/nsfw';
import type { NsfwMode } from '../domain/feedItemCardContracts';
import type { FeedItem } from '../types';
import { orderReaderItems, type ReaderItemOrder } from '../state/readerItemOrder';

export type ReaderItemsProjection = {
  items: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: Set<number>;
};

export function projectReaderItems({
  loadedItems,
  itemOrder,
  nsfwMode,
  deletedItemIds,
  requeuedItemIds,
}: {
  loadedItems: FeedItem[] | undefined;
  itemOrder: ReaderItemOrder;
  nsfwMode: NsfwMode;
  deletedItemIds: ReadonlySet<number>;
  requeuedItemIds: ReadonlySet<number>;
}): ReaderItemsProjection {
  const orderedItems = loadedItems ? orderReaderItems(loadedItems, itemOrder) : undefined;
  const availableItems = orderedItems?.filter((item) => !deletedItemIds.has(item.id));
  const items = availableItems?.filter((item) => nsfwMode !== 'hide' || !isNsfwLink(item.link));
  const visibleIds = availableItems?.map((item) => item.id) ?? [];
  const reviewableIds = [
    ...visibleIds.filter((id) => !requeuedItemIds.has(id)),
    ...visibleIds.filter((id) => requeuedItemIds.has(id)),
  ];

  return {
    items,
    reviewableIds,
    visibleItemIds: new Set(items?.map((item) => item.id) ?? []),
  };
}
