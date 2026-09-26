import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export type VkProviderData =
  | { provider: 'vk'; status: 'deleted' }
  | { provider: 'vk'; images: string[] };

export const vkProviderDataModule: ProviderDataModule<VkProviderData> = {
  is: isVkProviderData,
  imageUrls: getVkImageUrls,
};

export function isVkProviderData(value: unknown): value is VkProviderData {
  return isRecord(value)
    && value.provider === 'vk'
    && (value.status === 'deleted'
      || (Array.isArray(value.images)
        && value.images.length > 1
        && value.images.every((image: unknown) => typeof image === 'string')));
}

export function getVkStatus(value: unknown): 'deleted' | null {
  return isVkProviderData(value) && 'status' in value ? value.status : null;
}

export function getVkImageUrls(value: unknown): string[] {
  return isVkProviderData(value) && 'images' in value ? value.images : [];
}
