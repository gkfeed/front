import { createElement } from 'react';
import type { FeedItemProvider } from '../../domain/feedItemPreviewTypes';
import {
  EmptyRenderer,
  FeedItemMediaPreview,
  HltvPreview,
  HltvSupplementary,
  InstagramIdentity,
  LiquipediaPreview,
  MatreshkaCopy,
  MatreshkaVideoPreview,
  StandardCopy,
  TikTokSupplementary,
  TwitchCopy,
  TwitchVideoPreview,
  VkCopy,
  YoutubeCopy,
  YoutubeVideoPreview,
  type FeedItemCardProviderRenderer,
} from './feedItemCardProviderRenderers';

export const feedItemCardProviderRendererMap = {
  generic: createProviderRenderer({
    Preview: FeedItemMediaPreview,
    Copy: StandardCopy,
  }),
  hltv: createProviderRenderer({
    Preview: HltvPreview,
    Supplementary: HltvSupplementary,
    Copy: StandardCopy,
  }),
  instagram: createProviderRenderer({
    Identity: InstagramIdentity,
    Preview: FeedItemMediaPreview,
  }),
  liquipedia: createProviderRenderer({
    Preview: LiquipediaPreview,
    Copy: StandardCopy,
  }),
  matreshka: createProviderRenderer({
    Preview: MatreshkaVideoPreview,
    Copy: MatreshkaCopy,
  }),
  tiktok: createProviderRenderer({
    Preview: FeedItemMediaPreview,
    Supplementary: TikTokSupplementary,
  }),
  twitch: createProviderRenderer({
    Preview: TwitchVideoPreview,
    Copy: TwitchCopy,
  }),
  vk: createProviderRenderer({
    Preview: FeedItemMediaPreview,
    Copy: VkCopy,
  }),
  youtube: createProviderRenderer({
    Preview: YoutubeVideoPreview,
    Copy: YoutubeCopy,
  }),
} as const satisfies Readonly<Record<FeedItemProvider, FeedItemCardProviderRenderer>>;

export function getFeedItemCardProviderRenderer(
  provider: FeedItemProvider,
): FeedItemCardProviderRenderer {
  return feedItemCardProviderRendererMap[provider];
}

type FeedItemCardProviderRendererOverrides = Partial<FeedItemCardProviderRenderer>;

function createProviderRenderer(
  overrides: FeedItemCardProviderRendererOverrides,
): FeedItemCardProviderRenderer {
  const Copy = overrides.Copy ?? EmptyRenderer;

  return {
    ...overrides,
    Preview: overrides.Preview ?? EmptyRenderer,
    Supplementary: overrides.Supplementary ?? EmptyRenderer,
    Copy: withCopyVisibility(Copy),
    Identity: overrides.Identity ?? EmptyRenderer,
  };
}

function withCopyVisibility(
  Renderer: FeedItemCardProviderRenderer['Copy'],
): FeedItemCardProviderRenderer['Copy'] {
  return (props) => {
    if (props.model.descriptor.copy === 'none') return null;
    return createElement(Renderer, props);
  };
}
