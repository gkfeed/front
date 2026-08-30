import { createElement } from 'react';

import { SasflixPreview } from '../../previews/SasflixPreview';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderSasflixVideoPreview = createVariantRenderer('sasflix', ({ model, localizedPreview }: VariantRendererProps<'sasflix'>) => (
  <SasflixPreview href={model.item.link} title={model.item.title} videoSrc={model.openGraphPreview?.video ?? null} previewStatus={model.previewStatus} preview={localizedPreview} onPreviewError={model.onPreviewError} />
));

const renderSasflixCopy = createVariantRenderer('sasflix', ({ model }: VariantRendererProps<'sasflix'>) => (
  <div className="reader-card__copy reader-card__copy--player reader-card__sasflix-copy">
    <h2 className="reader-card__title">{model.item.title}</h2>
  </div>
), StandardCopy);

export function SasflixVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixVideoPreview, props);
}

export function SasflixCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixCopy, props);
}
