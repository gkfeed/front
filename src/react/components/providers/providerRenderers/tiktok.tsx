import { TikTokComments } from '../../previews/TikTokComments';
import type { FeedItemCardProviderRendererProps } from './common';

export function TikTokSupplementary({ facts }: FeedItemCardProviderRendererProps) {
  return <TikTokComments item={facts.item} />;
}
