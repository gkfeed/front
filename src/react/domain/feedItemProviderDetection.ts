import type { FeedItem } from '../types';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import {
  isHltvMatchUrl,
  isLiquipediaMatchUrl,
  isOneFootballMatchUrl,
  isTikTokVideoUrl,
  isVkHost,
} from '../../../shared/urlRules';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  parseUrl,
} from './feedItemUrls';
import { getTwitchChannel } from './twitchPreview';
import { isInstagramMediaUrl } from './instagramPreview';

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
}

export function getFeedItemProviderFromUrl(item: FeedItem, url: URL | null): FeedItemProvider {
  // A valid provider URL is more authoritative than a feed title marker. Some
  // imported TikTok items retain an `inst:` title prefix from their source.
  if (url) {
    if (getMatreshkaVideoId(url)) return 'matreshka';
    if (getSasflixPublicationId(url)) return 'sasflix';
    if (getYoutubeVideoId(url)) return 'youtube';
    if (getTwitchChannel(url)) return 'twitch';
    if (isTikTokVideoUrl(url)) return 'tiktok';
    if (isInstagramMediaUrl(url)) return 'instagram';
    if (isVkHost(url.hostname)) return 'vk';
    if (isHltvMatchUrl(url)) return 'hltv';
    if (isOneFootballMatchUrl(url)) return 'onefootball';
    if (isLiquipediaMatchUrl(url)) return 'liquipedia';
  }

  if (/^inst:\s*/i.test(item.title)) return 'instagram';
  return 'generic';
}

export function isYoutubeFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'youtube';
}

export function isTikTokFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'tiktok';
}

export function isInstagramFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'instagram';
}

export function isShortVideoFeedItem(item: FeedItem): boolean {
  const provider = getFeedItemProvider(item);
  return provider === 'instagram' || provider === 'tiktok';
}

export function isVkFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'vk';
}

export function isHltvFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'hltv';
}

export function isLiquipediaFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'liquipedia';
}
