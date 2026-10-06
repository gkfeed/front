import { isRecord } from './valueGuards.js';

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const CHANNEL_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const CHANNEL_TABS = new Set(['videos', 'shorts', 'streams', 'featured', 'playlists', 'community', 'about', 'releases', 'podcasts', 'courses', 'posts']);

export interface YoutubeChannelUrl {
  channelId: string | null;
  pageUrl: string;
  tab: string;
}

export interface YoutubeChannelResolution {
  channelId: string;
  url: string;
}

export function isYoutubeChannelId(value: unknown): value is string {
  return typeof value === 'string' && CHANNEL_ID.test(value);
}

/** Recognizes channel pages only. Video, playlist, and foreign URLs are excluded. */
export function parseYoutubeChannelUrl(input: string): YoutubeChannelUrl | null {
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol)
      || !CHANNEL_HOSTS.has(url.hostname)
      || url.username || url.password || url.port) return null;

    const match = url.pathname.match(/^\/(channel\/[^/]+|@[^/]+|(?:c|user)\/[^/]+)(?:\/([^/]+))?\/?$/);
    if (!match || (match[2] && !CHANNEL_TABS.has(match[2]))) return null;
    // Encoded separators must not turn a channel name into a different route.
    const locator = decodeURIComponent(match[1]);
    if (/[\\?#\s]/.test(locator) || locator.split('/').length !== match[1].split('/').length
      || locator === '@') return null;
    const channelId = locator.startsWith('channel/') ? locator.slice('channel/'.length) : null;
    if (channelId !== null && !isYoutubeChannelId(channelId)) return null;

    return {
      channelId,
      pageUrl: `https://www.youtube.com/${match[1]}`,
      tab: match[2] ? `/${match[2]}` : '',
    };
  } catch {
    return null;
  }
}

export function permanentYoutubeChannelUrl(channelId: string, tab: string): string {
  return `https://www.youtube.com/channel/${channelId}${tab}`;
}

export function isYoutubeChannelResolution(value: unknown): value is YoutubeChannelResolution {
  if (!isRecord(value) || !isYoutubeChannelId(value.channelId) || typeof value.url !== 'string') return false;
  const channel = parseYoutubeChannelUrl(value.url);
  return channel?.channelId === value.channelId
    && value.url === permanentYoutubeChannelUrl(value.channelId, channel.tab);
}
