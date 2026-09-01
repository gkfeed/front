import { hltvProviderDataModule, type HltvProviderData } from './providerData/hltv.js';
import {
  oneFootballProviderDataModule,
  type OneFootballProviderData,
} from './providerData/oneFootball.js';

export type OpenGraphProviderData = HltvProviderData | OneFootballProviderData | null;

const providerDataModules = [
  hltvProviderDataModule,
  oneFootballProviderDataModule,
] as const;

export function isOpenGraphProviderData(value: unknown): value is OpenGraphProviderData {
  return value === null || providerDataModules.some((module) => module.is(value));
}

export function getProviderDataImageUrls(value: unknown): readonly string[] {
  if (hltvProviderDataModule.is(value)) return hltvProviderDataModule.imageUrls(value);
  if (oneFootballProviderDataModule.is(value)) return oneFootballProviderDataModule.imageUrls(value);
  return [];
}
