import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export type RedditProviderData = { provider: 'reddit'; status: 'deleted' };

export const redditProviderDataModule: ProviderDataModule<RedditProviderData> = {
  is: isRedditProviderData,
  imageUrls: () => [],
};

export function isRedditProviderData(value: unknown): value is RedditProviderData {
  return isRecord(value) && value.provider === 'reddit' && value.status === 'deleted';
}

export function getRedditStatus(value: unknown): 'deleted' | null {
  return isRedditProviderData(value) ? value.status : null;
}
