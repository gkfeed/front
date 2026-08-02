import type { FeedItemPreview } from './feedItemPreviewTypes';
import { hostnameOf } from './feedItemUrls';

export function getTwitchChannel(url: URL): string | null {
  if (hostnameOf(url) !== 'twitch.tv') return null;
  return url.pathname.split('/').filter(Boolean)[0] ?? null;
}

export function getTwitchStreamTitle(title: string, channel: string): string {
  const normalizedTitle = title.trim();
  const prefix = new RegExp(`^${escapeRegExp(channel)}\\s*:\\s*`, 'i');
  return normalizedTitle.replace(prefix, '').trim() || normalizedTitle;
}

export function getTwitchPreview(url: URL): FeedItemPreview | null {
  const channel = getTwitchChannel(url);
  if (!channel) return null;

  return {
    src: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel)}-1920x1080.jpg`,
    alt: { kind: 'twitch', channel },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
