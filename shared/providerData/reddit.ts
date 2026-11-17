import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export type RedditProviderData = { provider: 'reddit'; status: 'deleted' } | {
  provider: 'reddit'; status: 'active'; body: string; author: string; comments: { author: string; text: string; depth: number }[];
};

export const redditProviderDataModule: ProviderDataModule<RedditProviderData> = {
  is: isRedditProviderData,
  imageUrls: () => [],
};

export function isRedditProviderData(value: unknown): value is RedditProviderData {
  return isRecord(value) && value.provider === 'reddit' && (value.status === 'deleted' || (
    value.status === 'active' && typeof value.body === 'string' && typeof value.author === 'string'
    && Array.isArray(value.comments) && value.comments.every((comment: unknown) => isRecord(comment)
      && typeof comment.author === 'string' && typeof comment.text === 'string' && typeof comment.depth === 'number')
  ));
}

export function getRedditStatus(value: unknown): 'deleted' | 'active' | null {
  return isRedditProviderData(value) ? value.status : null;
}
