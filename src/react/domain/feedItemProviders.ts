import type { FeedItem } from '../types';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import { getYoutubeVideoId, hostnameOf, isVkHost, parseUrl } from './feedItemUrls';

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
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

export function getFeedItemProviderFromUrl(item: FeedItem, url: URL | null): FeedItemProvider {
  if (/^inst:\s*/i.test(item.title)) return 'instagram';

  if (!url) return 'generic';

  const hostname = hostnameOf(url);
  if (getYoutubeVideoId(url)) return 'youtube';
  if (hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')) return 'tiktok';
  if (isVkHost(hostname)) return 'vk';
  if (hostname === 'hltv.org' && /^\/matches\/\d+(?:\/|$)/.test(url.pathname)) return 'hltv';
  if (hostname === 'liquipedia.net' && /\/Match(?::|%3A)/i.test(url.pathname)) return 'liquipedia';
  return 'generic';
}
