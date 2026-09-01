import type { FeedItem } from '../types';
import type { FeedItemAnalysis } from './feedItemPreviewTypes';
import { getFeedItemPreview } from './feedItemLocalPreview';
import { getFeedItemProviderFromUrl } from './feedItemProviderPresentation';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  hostnameOf,
  parseUrl,
} from './feedItemUrls';
import { getTwitchChannel } from './twitchPreview';

export function analyzeFeedItem(item: FeedItem): FeedItemAnalysis {
  const url = parseUrl(item.link);

  return {
    url,
    hostname: url ? hostnameOf(url) : null,
    provider: getFeedItemProviderFromUrl(item, url),
    localPreview: getFeedItemPreview(item),
    youtubeVideoId: url ? getYoutubeVideoId(url) : null,
    twitchChannel: url ? getTwitchChannel(url) : null,
    matreshkaVideoId: url ? getMatreshkaVideoId(url) : null,
    sasflixPublicationId: url ? getSasflixPublicationId(url) : null,
  };
}
