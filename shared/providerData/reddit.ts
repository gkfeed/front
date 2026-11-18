import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export type RedditComment = {
  author: string;
  text: string;
  depth: number;
  id?: string;
  replyTo?: string;
  images?: string[];
};

export type RedditProviderData = { provider: 'reddit'; status: 'deleted' } | {
  provider: 'reddit'; status: 'active'; body: string; author: string; comments: RedditComment[];
};

export function isRedditHostedImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const url = URL.parse(value);
  return Boolean(url && url.protocol === 'https:' && !url.username && !url.password && !url.port
    && ['i.redd.it', 'preview.redd.it', 'external-preview.redd.it'].includes(url.hostname)
    && /\.(?:jpe?g|png|gif|webp)$/i.test(url.pathname));
}

export const redditProviderDataModule: ProviderDataModule<RedditProviderData> = {
  is: isRedditProviderData,
  imageUrls: () => [],
};

export function isRedditProviderData(value: unknown): value is RedditProviderData {
  return isRecord(value) && value.provider === 'reddit' && (value.status === 'deleted' || (
    value.status === 'active' && typeof value.body === 'string' && typeof value.author === 'string'
    && Array.isArray(value.comments) && value.comments.every((comment: unknown) => isRecord(comment)
      && typeof comment.author === 'string' && typeof comment.text === 'string' && typeof comment.depth === 'number'
      && (comment.id === undefined || (typeof comment.id === 'string' && /^[a-z0-9]+$/i.test(comment.id)))
      && (comment.replyTo === undefined || typeof comment.replyTo === 'string')
      && (comment.images === undefined || (Array.isArray(comment.images) && comment.images.every(isRedditHostedImage))))
  ));
}

export function getRedditStatus(value: unknown): 'deleted' | 'active' | null {
  return isRedditProviderData(value) ? value.status : null;
}
