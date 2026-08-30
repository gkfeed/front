import { TikTokComments } from '../../previews/TikTokComments';
import type { FeedItemCardProviderRendererProps } from './common';

export function TikTokSupplementary({ model }: FeedItemCardProviderRendererProps) {
  return <TikTokComments item={model.item} />;
}
