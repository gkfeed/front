import { isLiveballProviderData, type LiveballProviderData } from './providerData/liveball.js';
import { hltvProviderDataModule, type HltvProviderData } from './providerData/hltv.js';
import {
  oneFootballProviderDataModule,
  type OneFootballProviderData,
} from './providerData/oneFootball.js';
import { vkProviderDataModule, type VkProviderData } from './providerData/vk.js';
import { redditProviderDataModule, type RedditProviderData } from './providerData/reddit.js';

export type OpenGraphProviderData = HltvProviderData | OneFootballProviderData | LiveballProviderData | VkProviderData | RedditProviderData | null;

const providerDataModules = [
  hltvProviderDataModule,
  oneFootballProviderDataModule,
  vkProviderDataModule,
  redditProviderDataModule,
] as const;

export function isOpenGraphProviderData(value: unknown): value is OpenGraphProviderData {
  return value === null || isLiveballProviderData(value) || providerDataModules.some((module) => module.is(value));
}

export function getProviderDataImageUrls(value: unknown): readonly string[] {
  if (isLiveballProviderData(value)) return oneFootballProviderDataModule.imageUrls({ provider: 'onefootball', snapshot: value.snapshot });
  if (hltvProviderDataModule.is(value)) return hltvProviderDataModule.imageUrls(value);
  if (oneFootballProviderDataModule.is(value)) return oneFootballProviderDataModule.imageUrls(value);
  if (vkProviderDataModule.is(value)) return vkProviderDataModule.imageUrls(value);
  return [];
}
