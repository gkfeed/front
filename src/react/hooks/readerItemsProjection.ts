import { isNsfwLink } from '../domain/nsfw';
import { isTikTokFeedItem } from '../domain/feedItemProviderPresentation';
import type { NsfwMode } from '../domain/feedItemCardContracts';
import type { FeedItem } from '../types';
import { orderFeedItems, type FeedPriorities } from '../state/feedPriority';
import type { ReaderItemOrder } from '../state/readerItemOrder';

export type ReaderItemsProjection = {
  items: FeedItem[] | undefined;
  reviewableIds: number[];
  visibleItemIds: Set<number>;
};

export function projectReaderItems({
  loadedItems,
  itemOrder,
  nsfwMode,
  hideTikTokItems,
  deletedItemIds,
  requeuedItemIds,
  feedPriorities = {},
}: {
  loadedItems: FeedItem[] | undefined;
  itemOrder: ReaderItemOrder;
  nsfwMode: NsfwMode;
  hideTikTokItems: boolean;
  deletedItemIds: ReadonlySet<number>;
  requeuedItemIds: ReadonlySet<number>;
  feedPriorities?: FeedPriorities;
}): ReaderItemsProjection {
  const orderedItems = loadedItems ? orderFeedItems(loadedItems, itemOrder, feedPriorities) : undefined;
  const availableItems = orderedItems?.filter((item) => !deletedItemIds.has(item.id));
  const items = availableItems?.filter((item) => (
    (nsfwMode !== 'hide' || !isNsfwLink(item.link))
    && (!hideTikTokItems || !isTikTokFeedItem(item))
  ));
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
