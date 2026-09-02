import type { FeedItemCardModel } from '../useFeedItemCardModel';

export function getFeedItemCardClassNames(facts: FeedItemCardModel): readonly string[] {
  return [
    ...getProviderClassNames(facts),
    ...(facts.imagePreview.type !== 'none' ? ['reader-card--image-preview'] : []),
    ...(facts.imagePreview.type === 'generated' && facts.imagePreview.source === 'reddit'
      ? ['reader-card--reddit-preview']
      : []),
    ...(facts.imagePreview.type === 'hltv' ? ['reader-card--hltv-preview'] : []),
  ];
}

function getProviderClassNames(facts: FeedItemCardModel): readonly string[] {
  switch (facts.provider) {
    case 'generic': return facts.variant.type === 'simple-image' ? ['reader-card--simple-image'] : [];
    case 'hltv': return [];
    case 'instagram':
      return [
        'reader-card--short-video',
        'reader-card--instagram',
        ...(facts.variant.type === 'instagram' && facts.variant.media === 'photo'
          ? ['reader-card--instagram-photo', 'reader-card--portrait-image']
          : []),
      ];
    case 'liquipedia': return ['reader-card--liquipedia'];
    case 'matreshka': return facts.variant.type === 'matreshka' ? ['reader-card--matreshka', 'reader-card--player', 'reader-card--landscape-media'] : [];
    case 'onefootball': return ['reader-card--onefootball'];
    case 'sasflix': return facts.variant.type === 'sasflix' ? ['reader-card--sasflix', 'reader-card--player', 'reader-card--landscape-media'] : [];
    case 'tiktok': return ['reader-card--short-video', 'reader-card--tiktok'];
    case 'twitch': return facts.variant.type === 'twitch' ? ['reader-card--twitch', 'reader-card--player', 'reader-card--landscape-media'] : [];
    case 'vk': return ['reader-card--vk'];
    case 'youtube': return facts.variant.type === 'youtube' ? ['reader-card--youtube', 'reader-card--player', 'reader-card--landscape-media'] : [];
    default: return assertNever(facts.provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item provider: ${value}`);
}
