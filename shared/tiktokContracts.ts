import { isRecord } from './valueGuards.js';

export interface TikTokComment {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
}

export interface TikTokCommentsPreview {
  comments: TikTokComment[];
  description: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
}

export function isTikTokCommentsPreview(value: unknown): value is TikTokCommentsPreview {
  return isRecord(value)
    && Array.isArray(value.comments)
    && value.comments.every(isTikTokComment)
    && isNullableString(value.description)
    && isNullableString(value.creatorName)
    && isNullableString(value.creatorAvatarUrl);
}

export function isTikTokComment(value: unknown): value is TikTokComment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.text === 'string'
    && typeof value.author === 'string'
    && typeof value.username === 'string'
    && isNullableString(value.avatarUrl);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export interface TikTokPlaybackAuthor {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
}

export interface TikTokPlaybackPreview {
  videoUrl: string;
  author?: TikTokPlaybackAuthor;
}

export function isTikTokAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function isTikTokMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'tikwm.com']
        .some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function isTikTokPlaybackPreview(value: unknown): value is TikTokPlaybackPreview {
  return isRecord(value) && isTikTokMediaUrl(value.videoUrl)
    && (value.author === undefined || (
      isRecord(value.author)
      && isNullableString(value.author.name)
      && isNullableString(value.author.username)
      && (value.author.avatarUrl === null || isTikTokAvatarUrl(value.author.avatarUrl))
    ));
}
