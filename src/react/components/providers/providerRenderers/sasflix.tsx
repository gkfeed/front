import { createElement } from 'react';

import { SasflixPreview } from '../../previews/SasflixPreview';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderSasflixVideoPreview = createVariantRenderer('sasflix', ({ facts, localizedPreview }: VariantRendererProps<'sasflix'>) => (
  <SasflixPreview href={facts.item.link} title={facts.item.title} videoSrc={facts.videoSrc} previewStatus={facts.previewStatus} preview={localizedPreview} onPreviewError={facts.onPreviewError} />
));

const renderSasflixCopy = createVariantRenderer('sasflix', ({ facts }: VariantRendererProps<'sasflix'>) => (
  <div className="reader-card__copy reader-card__copy--player reader-card__sasflix-copy">
    <h2 className="reader-card__title">{facts.item.title}</h2>
  </div>
), StandardCopy);

export function SasflixVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixVideoPreview, props);
}

export function SasflixCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixCopy, props);
}
