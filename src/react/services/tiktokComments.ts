import { requestBffJson } from './bffClient';

export type TikTokComment = {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
};

export type TikTokCommentsResult = {
  comments: TikTokComment[];
  description: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

export async function fetchTikTokComments(
  url: string,
  signal: AbortSignal,
): Promise<TikTokCommentsResult> {
  return requestBffJson({
    endpoint: '/api/bff/tiktok-comments',
    input: url,
    resourceName: 'TikTok comments',
    validate: isTikTokCommentsResult,
    signal,
  });
}

function isTikTokCommentsResult(value: unknown): value is TikTokCommentsResult {
  return isRecord(value)
    && Array.isArray(value.comments)
    && value.comments.every(isTikTokComment)
    && (value.description === null || typeof value.description === 'string')
    && (value.creatorName === null || typeof value.creatorName === 'string')
    && (value.creatorAvatarUrl === null || typeof value.creatorAvatarUrl === 'string');
}

function isTikTokComment(value: unknown): value is TikTokComment {
  return isRecord(value)
    && ['id', 'text', 'author', 'username'].every((key) => typeof value[key] === 'string')
    && (value.avatarUrl === null || typeof value.avatarUrl === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
