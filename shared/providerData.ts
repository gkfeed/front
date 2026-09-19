import { hltvProviderDataModule, type HltvProviderData } from './providerData/hltv.js';
import {
  oneFootballProviderDataModule,
  type OneFootballProviderData,
} from './providerData/oneFootball.js';
import { vkProviderDataModule, type VkProviderData } from './providerData/vk.js';

export type OpenGraphProviderData = HltvProviderData | OneFootballProviderData | VkProviderData | null;

const providerDataModules = [
  hltvProviderDataModule,
  oneFootballProviderDataModule,
  vkProviderDataModule,
] as const;

export function isOpenGraphProviderData(value: unknown): value is OpenGraphProviderData {
  return value === null || providerDataModules.some((module) => module.is(value));
}

export function getProviderDataImageUrls(value: unknown): readonly string[] {
  if (hltvProviderDataModule.is(value)) return hltvProviderDataModule.imageUrls(value);
  if (oneFootballProviderDataModule.is(value)) return oneFootballProviderDataModule.imageUrls(value);
  if (vkProviderDataModule.is(value)) return vkProviderDataModule.imageUrls(value);
  return [];
}
