import type { ProviderDataModule } from './contracts.js';
import { isRecord } from '../valueGuards.js';

export interface VkProviderData {
  provider: 'vk';
  status: 'deleted';
}

export const vkProviderDataModule: ProviderDataModule<VkProviderData> = {
  is: isVkProviderData,
  imageUrls: () => [],
};

export function isVkProviderData(value: unknown): value is VkProviderData {
  return isRecord(value)
    && value.provider === 'vk'
    && value.status === 'deleted';
}

export function getVkStatus(value: unknown): VkProviderData['status'] | null {
  return isVkProviderData(value) ? value.status : null;
}
