import type { FeedItemProvider } from '../../domain/feedItemPreviewTypes';
import {
  EmptyRenderer,
  FeedItemMediaPreview,
  HltvPreview,
  HltvSupplementary,
  LiquipediaPreview,
  MatreshkaCopy,
  MatreshkaVideoPreview,
  StandardCopy,
  TikTokSupplementary,
  TwitchCopy,
  TwitchVideoPreview,
  YoutubeCopy,
  YoutubeVideoPreview,
  type FeedItemCardProviderRenderer,
} from './feedItemCardProviderRenderers';

const feedItemCardProviderRenderers: Record<FeedItemProvider, FeedItemCardProviderRenderer> = {
  generic: createRenderer({
    Preview: FeedItemMediaPreview,
    Copy: StandardCopy,
  }),
  hltv: createRenderer({
    Preview: HltvPreview,
    Supplementary: HltvSupplementary,
    Copy: StandardCopy,
  }),
  instagram: createRenderer({
    Preview: FeedItemMediaPreview,
  }),
  liquipedia: createRenderer({
    Preview: LiquipediaPreview,
    Copy: StandardCopy,
  }),
  matreshka: createRenderer({
    Preview: MatreshkaVideoPreview,
    Copy: MatreshkaCopy,
  }),
  tiktok: createRenderer({
    Preview: FeedItemMediaPreview,
    Supplementary: TikTokSupplementary,
  }),
  twitch: createRenderer({
    Preview: TwitchVideoPreview,
    Copy: TwitchCopy,
  }),
  vk: createRenderer({
    Preview: FeedItemMediaPreview,
    Copy: StandardCopy,
  }),
  youtube: createRenderer({
    Preview: YoutubeVideoPreview,
    Copy: YoutubeCopy,
  }),
};

export function getFeedItemCardProviderRenderer(provider: FeedItemProvider) {
  return feedItemCardProviderRenderers[provider];
}

function createRenderer(
  overrides: Partial<FeedItemCardProviderRenderer>,
): FeedItemCardProviderRenderer {
  return {
    Preview: EmptyRenderer,
    Supplementary: EmptyRenderer,
    Copy: EmptyRenderer,
    ...overrides,
  };
}
