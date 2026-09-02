import type { FeedItem } from '../types';
import type { FeedItemProviderViewModel } from './feedItemPreviewTypes';
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

export function analyzeFeedItem(item: FeedItem): FeedItemProviderViewModel {
  const url = parseUrl(item.link);
  const provider = getFeedItemProviderFromUrl(item, url);
  const providerViewModel = (() => {
    switch (provider) {
      case 'generic': return { provider, simpleImage: false } as const;
      case 'hltv': return { provider } as const;
      case 'instagram': return { provider, media: 'video' } as const;
      case 'liquipedia': return { provider } as const;
      case 'matreshka': return { provider, videoId: getRequiredValue(url && getMatreshkaVideoId(url), provider) } as const;
      case 'onefootball': return { provider, simpleImage: false } as const;
      case 'sasflix': return { provider, publicationId: getRequiredValue(url && getSasflixPublicationId(url), provider) } as const;
      case 'tiktok': return { provider } as const;
      case 'twitch': return { provider, channel: getRequiredValue(url && getTwitchChannel(url), provider) } as const;
      case 'vk': return { provider } as const;
      case 'youtube': return { provider, videoId: getRequiredValue(url && getYoutubeVideoId(url), provider) } as const;
      default: return assertNever(provider);
    }
  })();

  return {
    ...providerViewModel,
    url,
    hostname: url ? hostnameOf(url) : null,
    localPreview: getFeedItemPreview(item),
  };
}

function getRequiredValue(value: string | null, provider: string): string {
  if (value) return value;
  throw new Error(`Missing payload for detected ${provider} feed item`);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item provider: ${value}`);
}
