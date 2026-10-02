import { Suspense, type ReactNode } from 'react';

import type { FeedItemCardModel } from '../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { GenericCardContent } from './providerRenderers/common';
import { feedPluginUiCatalog } from './feedPluginUiCatalog';

export function FeedItemCardProviderContent(props: {
  facts: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  previewPlaceholder: ReactNode;
  onOpenArticle?: () => void;
}) {
  const Card = props.facts.provider === 'generic'
    ? GenericCardContent
    : feedPluginUiCatalog[props.facts.provider].Card;
  return <Suspense fallback={props.previewPlaceholder}><Card {...props} /></Suspense>;
}
