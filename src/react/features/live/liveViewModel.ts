import { getFeedItemPreview } from '../../domain/feedItemLocalPreview';
import {
  getTwitchChannel as getTwitchChannelFromUrl,
  getTwitchStreamTitle,
} from '../../domain/twitchPreview';
import type { FeedItem } from '../../types';
import type { FeedItemPreview } from '../../domain/feedItemPreviewTypes';

export type LiveStreamViewModel = {
  item: FeedItem;
  channel: string;
  title: string;
  preview: FeedItemPreview | null;
};

export function toLiveStreamViewModel(item: FeedItem): LiveStreamViewModel {
  const channel = getTwitchChannel(item);

  return {
    item,
    channel,
    title: getTwitchStreamTitle(item.title, channel),
    preview: getFeedItemPreview(item),
  };
}

function getTwitchChannel(item: FeedItem): string {
  try {
    return getTwitchChannelFromUrl(new URL(item.link)) ?? item.title;
  } catch {
    return item.title;
  }
}
