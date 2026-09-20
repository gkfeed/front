import type { OpenGraphProviderAdapter } from './openGraphProviderAdapter.js';
import { hltvOpenGraphAdapter } from './providers/hltv.js';
import { instagramOpenGraphAdapter } from './providers/instagram.js';
import { matreshkaOpenGraphAdapter } from './providers/matreshka.js';
import { oneFootballOpenGraphAdapter } from './providers/oneFootball.js';
import { rezkaOpenGraphAdapter } from './providers/rezka.js';
import { sasflixOpenGraphAdapter } from './providers/sasflix.js';
import { shikimoriOpenGraphAdapter } from './providers/shikimori.js';
import { vkOpenGraphAdapter } from './providers/vk.js';
import { youtubeOpenGraphAdapter } from './providers/youtube.js';

export const openGraphProviderAdapters: readonly OpenGraphProviderAdapter[] = [
  hltvOpenGraphAdapter,
  oneFootballOpenGraphAdapter,
  rezkaOpenGraphAdapter,
  instagramOpenGraphAdapter,
  matreshkaOpenGraphAdapter,
  sasflixOpenGraphAdapter,
  shikimoriOpenGraphAdapter,
  vkOpenGraphAdapter,
  youtubeOpenGraphAdapter,
];

export function findOpenGraphProviderAdapter(url: URL): OpenGraphProviderAdapter | undefined {
  return openGraphProviderAdapters.find((adapter) => adapter.matches(url));
}
