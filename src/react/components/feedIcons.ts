import type { Feed } from '../types';

export interface FeedTypeIcon {
  label: string;
  path: string;
}

const FEED_TYPE_ICONS: Record<string, FeedTypeIcon> = {
  instagram: { label: 'Instagram feed type', path: 'M16 2h16c7.7 0 14 6.3 14 14v16c0 7.7-6.3 14-14 14H16C8.3 46 2 39.7 2 32V16C2 8.3 8.3 2 16 2Zm0 5C11.1 7 7 11.1 7 16v16c0 4.9 4.1 9 9 9h16c4.9 0 9-4.1 9-9V16c0-4.9-4.1-9-9-9H16Zm8 9.5A7.5 7.5 0 1 1 24 31a7.5 7.5 0 0 1 0-15Zm0 5A2.5 2.5 0 1 0 24 26a2.5 2.5 0 0 0 0-5Zm10.8-7.8a3 3 0 1 1-3 3a3 3 0 0 1 3-3Z' },
  rss: { label: 'RSS feed type', path: 'M8 8c17.7 0 32 14.3 32 32h-7C33 26.2 21.8 15 8 15V8Zm0 13c10.5 0 19 8.5 19 19h-7c0-6.6-5.4-12-12-12v-7Zm5 10a5 5 0 1 1 0 10a5 5 0 0 1 0-10Z' },
  tiktok: { label: 'Short video feed type', path: 'M31 4c1.2 6.2 5.1 10.1 11 11v7.2c-4.1-.1-7.8-1.4-11-3.8v12.8c0 8.1-5.7 13.8-13.7 13.8C9.8 45 4 39.6 4 32.5C4 25 9.9 19.7 17.7 19.7c1.1 0 2.1.1 3.2.4v7.7c-1-.4-2-.7-3.1-.7c-3.3 0-5.9 2.2-5.9 5.3c0 3 2.4 5.2 5.4 5.2c3.3 0 5.6-2.3 5.6-6.3V4h8.1Z' },
  web: { label: 'Website feed type', path: 'M24 4a20 20 0 1 1 0 40a20 20 0 0 1 0-40Zm-7.7 23c.5 6.1 2.8 11 5.4 12V27h-5.4Zm10 0v12c2.6-1 4.9-5.9 5.4-12h-5.4Zm-17.1 0a15.1 15.1 0 0 0 8.1 10.9c-1.8-2.8-3.1-6.6-3.5-10.9H9.2Zm25 0c-.4 4.3-1.7 8.1-3.5 10.9A15.1 15.1 0 0 0 38.8 27h-4.6Zm-20.4-6c.4-4.3 1.7-8.1 3.5-10.9A15.1 15.1 0 0 0 9.2 21h4.6Zm7.9-12c-2.6 1-4.9 5.9-5.4 12h5.4V9Zm4.6 0v12h5.4c-.5-6.1-2.8-11-5.4-12Zm4.4 1.1c1.8 2.8 3.1 6.6 3.5 10.9h4.6a15.1 15.1 0 0 0-8.1-10.9Z' },
  x: { label: 'X feed type', path: 'M7 5h9.2l9 12.4L35.8 5H42L28.2 21.2L43 43h-9.2l-9.7-14L12.1 43H6l15-17.6L7 5Zm8 4.7l21.2 28.6H35L13.8 9.7H15Z' },
  youtube: { label: 'YouTube feed type', path: 'M43.2 14.4c-.5-2.1-2.2-3.8-4.3-4.3C35.1 9 24 9 24 9s-11.1 0-14.9 1.1c-2.1.5-3.8 2.2-4.3 4.3C3.8 18.2 3.8 24 3.8 24s0 5.8 1 9.6c.5 2.1 2.2 3.8 4.3 4.3C12.9 39 24 39 24 39s11.1 0 14.9-1.1c2.1-.5 3.8-2.2 4.3-4.3c1-3.8 1-9.6 1-9.6s0-5.8-1-9.6ZM20 30.5v-13l11.2 6.5L20 30.5Z' },
};

const FEED_TYPE_ALIASES: Record<string, string> = {
  inst: 'instagram',
  stories: 'instagram',
  twitter: 'x',
  yt: 'youtube',
};

export function getFeedIcon(feed: Feed): FeedTypeIcon {
  const type = feed.type.trim().toLowerCase();
  const url = feed.url.toLowerCase();
  const icon = FEED_TYPE_ICONS[FEED_TYPE_ALIASES[type] ?? type];

  if (icon) return icon;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return FEED_TYPE_ICONS.youtube;
  if (url.includes('instagram.com')) return FEED_TYPE_ICONS.instagram;
  if (url.includes('tiktok.com')) return FEED_TYPE_ICONS.tiktok;
  if (url.includes('twitter.com') || url.includes('x.com')) return FEED_TYPE_ICONS.x;
  return type.includes('rss') ? FEED_TYPE_ICONS.rss : FEED_TYPE_ICONS.web;
}
