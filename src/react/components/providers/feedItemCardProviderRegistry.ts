import { createElement } from 'react';
import type { FeedItemProvider } from '../../domain/feedItemPreviewTypes';
import {
  EmptyRenderer,
  FeedItemMediaPreview,
  StandardCopy,
  type FeedItemCardProviderRenderer,
} from './providerRenderers/common';
import { HltvPreview, HltvSupplementary } from './providerRenderers/hltv';
import { InstagramPreview } from './providerRenderers/instagram';
import { LiquipediaPreview } from './providerRenderers/liquipedia';
import { MatreshkaCopy, MatreshkaVideoPreview } from './providerRenderers/matreshka';
import { OneFootballCopy, OneFootballPreview } from './providerRenderers/onefootball';
import { SasflixCopy, SasflixVideoPreview } from './providerRenderers/sasflix';
import { TikTokSupplementary } from './providerRenderers/tiktok';
import { TwitchCopy, TwitchVideoPreview } from './providerRenderers/twitch';
import { VkCopy } from './providerRenderers/vk';
import { YoutubeCopy, YoutubeVideoPreview } from './providerRenderers/youtube';

export const feedItemCardProviderRendererMap = {
  generic: createProviderRenderer({
    cardClassNames: ({ variant }) => variant.type === 'simple-image'
      ? ['reader-card--simple-image']
      : [],
    Preview: FeedItemMediaPreview,
    Copy: StandardCopy,
  }),
  hltv: createProviderRenderer({
    Preview: HltvPreview,
    Supplementary: HltvSupplementary,
    Copy: StandardCopy,
  }),
  instagram: createProviderRenderer({
    cardClassNames: ({ variant }) => [
      'reader-card--short-video',
      'reader-card--instagram',
      ...(variant.type === 'instagram' && variant.media === 'photo'
        ? ['reader-card--instagram-photo', 'reader-card--portrait-image']
        : []),
    ],
    Preview: InstagramPreview,
  }),
  liquipedia: createProviderRenderer({
    cardClassNames: () => ['reader-card--liquipedia'],
    Preview: LiquipediaPreview,
    Copy: StandardCopy,
  }),
  matreshka: createProviderRenderer({
    cardClassNames: ({ variant }) => variant.type === 'matreshka'
      ? ['reader-card--matreshka', 'reader-card--player', 'reader-card--landscape-media']
      : [],
    Preview: MatreshkaVideoPreview,
    Copy: MatreshkaCopy,
  }),
  onefootball: createProviderRenderer({
    cardClassNames: () => ['reader-card--onefootball'],
    Preview: OneFootballPreview,
    Copy: OneFootballCopy,
  }),
  sasflix: createProviderRenderer({
    cardClassNames: ({ variant }) => variant.type === 'sasflix'
      ? ['reader-card--sasflix', 'reader-card--player', 'reader-card--landscape-media']
      : [],
    Preview: SasflixVideoPreview,
    Copy: SasflixCopy,
  }),
  tiktok: createProviderRenderer({
    cardClassNames: () => ['reader-card--short-video', 'reader-card--tiktok'],
    Preview: FeedItemMediaPreview,
    Supplementary: TikTokSupplementary,
  }),
  twitch: createProviderRenderer({
    cardClassNames: ({ variant }) => variant.type === 'twitch'
      ? ['reader-card--twitch', 'reader-card--player', 'reader-card--landscape-media']
      : [],
    Preview: TwitchVideoPreview,
    Copy: TwitchCopy,
  }),
  vk: createProviderRenderer({
    cardClassNames: () => ['reader-card--vk'],
    Preview: FeedItemMediaPreview,
    Copy: VkCopy,
  }),
  youtube: createProviderRenderer({
    cardClassNames: ({ variant }) => variant.type === 'youtube'
      ? ['reader-card--youtube', 'reader-card--player', 'reader-card--landscape-media']
      : [],
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
    cardClassNames: (model) => [
      ...(overrides.cardClassNames?.(model) ?? []),
      ...(model.imagePreview.type !== 'none' ? ['reader-card--image-preview'] : []),
      ...(model.imagePreview.type === 'generated' && model.imagePreview.source === 'reddit'
        ? ['reader-card--reddit-preview']
        : []),
      ...(model.imagePreview.type === 'hltv' ? ['reader-card--hltv-preview'] : []),
    ],
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
