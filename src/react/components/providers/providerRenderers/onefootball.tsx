import type { ComponentType } from 'react';

import { OneFootballMatch } from '../../previews/OneFootballMatch';
import {
  FeedItemMediaPreview,
  type FeedItemCardProviderRendererProps,
} from './common';

export function OneFootballPreview(props: FeedItemCardProviderRendererProps) {
  const { facts } = props;
  if (!facts.oneFootballSnapshot) return <FeedItemMediaPreview {...props} />;
  return <OneFootballMatch href={facts.item.link} snapshot={facts.oneFootballSnapshot} />;
}

export const OneFootballCopy: ComponentType<FeedItemCardProviderRendererProps> = () => null;
