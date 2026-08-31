import { isRecord } from '../shared/valueGuards.js';
import { normalizeExternalText } from '../shared/text.js';
import type { TikTokCommentsPreview } from '../shared/tiktokContracts.js';
import { parseTikTokHttpUrl } from './tiktokUrlParser.js';

export type TikTokDetails = Pick<
  TikTokCommentsPreview,
  'description' | 'creatorName' | 'creatorAvatarUrl'
>;

export function parseTikTokDescription(value: unknown): string | null {
  if (!isRecord(value) || typeof value.title !== 'string') return null;
  return normalizeExternalText(value.title) || null;
}

export function parseTikTokDetails(value: unknown): TikTokDetails | null {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)) return null;
  const author = isRecord(value.data.author) ? value.data.author : {};
  return {
    description: typeof value.data.title === 'string'
      ? normalizeExternalText(value.data.title) || null
      : null,
    creatorName: typeof author.nickname === 'string'
      ? normalizeExternalText(author.nickname) || null
      : null,
    creatorAvatarUrl: typeof author.avatar === 'string' ? parseTikTokHttpUrl(author.avatar) : null,
  };
}

export function parseTikTokOEmbedDetails(value: unknown): TikTokDetails {
  return {
    description: parseTikTokDescription(value),
    creatorName: isRecord(value) && typeof value.author_name === 'string'
      ? normalizeExternalText(value.author_name) || null
      : null,
    creatorAvatarUrl: null,
  };
}

export function emptyTikTokDetails(): TikTokDetails {
  return { description: null, creatorName: null, creatorAvatarUrl: null };
}
