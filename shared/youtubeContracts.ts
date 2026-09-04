import { isRecord } from './valueGuards.js';

export interface YoutubeComment {
  id: string;
  text: string;
  author: string;
  avatarUrl: string | null;
  publishedTime: string | null;
  likeCount: string | null;
}

export interface YoutubeCommentsPreview {
  comments: YoutubeComment[];
}

export function isYoutubeCommentsPreview(value: unknown): value is YoutubeCommentsPreview {
  return isRecord(value)
    && Array.isArray(value.comments)
    && value.comments.every(isYoutubeComment);
}

function isYoutubeComment(value: unknown): value is YoutubeComment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.text === 'string'
    && typeof value.author === 'string'
    && isNullableString(value.avatarUrl)
    && isNullableString(value.publishedTime)
    && isNullableString(value.likeCount);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
