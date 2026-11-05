import { isLiveballProviderData, type LiveballProviderData } from './providerData/liveball.js';
import { hltvProviderDataModule, type HltvProviderData } from './providerData/hltv.js';
import {
  oneFootballProviderDataModule,
  type OneFootballProviderData,
} from './providerData/oneFootball.js';

export type OpenGraphProviderData = HltvProviderData | OneFootballProviderData | LiveballProviderData | null;

const providerDataModules = [
  hltvProviderDataModule,
  oneFootballProviderDataModule,
] as const;

export function isOpenGraphProviderData(value: unknown): value is OpenGraphProviderData {
  return value === null || isLiveballProviderData(value) || providerDataModules.some((module) => module.is(value));
}

export function getProviderDataImageUrls(value: unknown): readonly string[] {
  if (isLiveballProviderData(value)) return oneFootballProviderDataModule.imageUrls({ provider: 'onefootball', snapshot: value.snapshot });
  if (hltvProviderDataModule.is(value)) return hltvProviderDataModule.imageUrls(value);
  if (oneFootballProviderDataModule.is(value)) return oneFootballProviderDataModule.imageUrls(value);
  return [];
}
