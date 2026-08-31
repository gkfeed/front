import { PreviewError } from './preview/errors.js';
import { isRecord } from '../shared/valueGuards.js';
import { normalizeExternalText } from '../shared/text.js';
import type { TikTokComment } from '../shared/tiktokContracts.js';
import { parseTikTokHttpUrl } from './tiktokUrlParser.js';

export function parseTikTokComments(value: unknown): TikTokComment[] {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data) || !Array.isArray(value.data.comments)) {
    throw new PreviewError('The comments provider returned invalid data', 'invalid_comments');
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
    const avatarUrl = typeof user.avatar === 'string' ? parseTikTokHttpUrl(user.avatar) : null;

    const text = normalizeExternalText(comment.text);
    return text ? [{
      id: comment.id,
      text,
      author,
      username,
      avatarUrl,
    }] : [];
  });
}
