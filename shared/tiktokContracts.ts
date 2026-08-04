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
