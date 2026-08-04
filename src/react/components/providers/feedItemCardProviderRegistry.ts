import { createElement } from 'react';
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

const feedItemCardProviderRenderers = {
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
} satisfies Readonly<Record<FeedItemProvider, FeedItemCardProviderRenderer>>;

export function getFeedItemCardProviderRenderer(
  provider: FeedItemProvider,
): FeedItemCardProviderRenderer {
  return feedItemCardProviderRenderers[provider];
}

function createRenderer(
  overrides: Partial<FeedItemCardProviderRenderer>,
): FeedItemCardProviderRenderer {
  const Copy = overrides.Copy ?? EmptyRenderer;

  return {
    ...overrides,
    Preview: overrides.Preview ?? EmptyRenderer,
    Supplementary: overrides.Supplementary ?? EmptyRenderer,
    Copy: withCopyVisibility(Copy),
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
