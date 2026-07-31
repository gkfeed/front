import { PreviewError } from './preview/errors.js';
import { isRecord } from '../shared/previewGuards.js';

export type TikTokComment = {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
};

export type TikTokDetails = {
  description: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

export function parseTikTokComments(value: unknown): TikTokComment[] {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data) || !Array.isArray(value.data.comments)) {
    throw new PreviewError('The comments provider returned invalid data', 502, 'invalid_comments');
  }

  return value.data.comments.slice(0, 10).flatMap((comment) => {
    if (!isRecord(comment) || typeof comment.id !== 'string' || typeof comment.text !== 'string') return [];
    const user = isRecord(comment.user) ? comment.user : {};
    const author = typeof user.nickname === 'string' && user.nickname.trim()
      ? user.nickname.trim()
      : typeof user.unique_id === 'string' && user.unique_id.trim()
        ? user.unique_id.trim()
        : 'TikTok user';
    const username = typeof user.unique_id === 'string' ? user.unique_id.trim() : '';
    const avatarUrl = typeof user.avatar === 'string' ? safeHttpUrl(user.avatar) : null;

    return comment.text.trim() ? [{
      id: comment.id,
      text: comment.text.trim(),
      author,
      username,
      avatarUrl,
    }] : [];
  });
}

export function parseTikTokDescription(value: unknown): string | null {
  if (!isRecord(value) || typeof value.title !== 'string') return null;
  return value.title.replace(/\s+/g, ' ').trim() || null;
}

export function parseTikTokDetails(value: unknown): TikTokDetails | null {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)) return null;
  const author = isRecord(value.data.author) ? value.data.author : {};
  return {
    description: typeof value.data.title === 'string'
      ? value.data.title.replace(/\s+/g, ' ').trim() || null
      : null,
    creatorName: typeof author.nickname === 'string'
      ? author.nickname.replace(/\s+/g, ' ').trim() || null
      : null,
    creatorAvatarUrl: typeof author.avatar === 'string' ? safeHttpUrl(author.avatar) : null,
  };
}

export function parseTikTokOEmbedDetails(value: unknown): TikTokDetails {
  return {
    description: parseTikTokDescription(value),
    creatorName: isRecord(value) && typeof value.author_name === 'string'
      ? value.author_name.replace(/\s+/g, ' ').trim() || null
      : null,
    creatorAvatarUrl: null,
  };
}

export function parseTikTokVideoUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError('A valid TikTok video URL is required', 400, 'invalid_tiktok_url');
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (
    (hostname !== 'tiktok.com' && !hostname.endsWith('.tiktok.com'))
    || !/\/video\/\d+/.test(url.pathname)
    || !['http:', 'https:'].includes(url.protocol)
  ) {
    throw new PreviewError('A valid TikTok video URL is required', 400, 'invalid_tiktok_url');
  }
  return url;
}

export function emptyTikTokDetails(): TikTokDetails {
  return { description: null, creatorName: null, creatorAvatarUrl: null };
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
