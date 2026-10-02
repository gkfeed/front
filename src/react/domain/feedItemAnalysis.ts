import type { FeedItem } from '../types';
import type { FeedItemProviderViewModel } from './feedItemPreviewTypes';
import { getFeedItemPreview } from './feedItemLocalPreview';
import { feedItemProviderResources, getFeedItemProviderFromUrl } from './feedItemProviderPresentation';
import {
  hostnameOf,
  parseUrl,
} from './feedItemUrls';
import type { FeedPluginId } from './feedItemProviderPresentation';

export function analyzeFeedItem(
  item: FeedItem,
  disabledPlugins: ReadonlySet<FeedPluginId> = new Set(),
): FeedItemProviderViewModel {
  const url = parseUrl(item.link);
  const provider = getFeedItemProviderFromUrl(item, url, disabledPlugins);
  const providerViewModel = feedItemProviderResources[provider].analyze(item, url);

  return {
    ...providerViewModel,
    url,
    hostname: url ? hostnameOf(url) : null,
    localPreview: getFeedItemPreview(item, disabledPlugins),
  };
}
