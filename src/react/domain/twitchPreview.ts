import type { FeedItemPreview } from './feedItemPreviewTypes';
import { hostnameOf } from './feedItemUrls';

export function getTwitchPreview(url: URL): FeedItemPreview | null {
  if (hostnameOf(url) !== 'twitch.tv') return null;

  const channel = url.pathname.split('/').filter(Boolean)[0];
  if (!channel) return null;

  return {
    src: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel)}-1920x1080.jpg`,
    alt: { kind: 'twitch', channel },
  };
}
