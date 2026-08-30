import { createElement } from 'react';

import { YoutubePreview } from '../../previews/YoutubePreview';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderYoutubeVideoPreview = createVariantRenderer('youtube', ({ model, localizedPreview }: VariantRendererProps<'youtube'>) => (
  <YoutubePreview videoId={model.variant.videoId} title={model.item.text || model.item.title} preview={localizedPreview} onPreviewError={model.onPreviewError} />
));

const renderYoutubeCopy = createVariantRenderer('youtube', ({ model }: VariantRendererProps<'youtube'>) => (
  <div className="reader-card__copy reader-card__copy--player reader-card__youtube-copy">
    <h2 className="reader-card__title">{model.item.text || model.item.title}</h2>
    <p className="reader-card__channel">{model.item.title.replace(/^YT:\s*/i, '').trim() || 'YouTube'}</p>
  </div>
), StandardCopy);

export function YoutubeVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeVideoPreview, props);
}

export function YoutubeCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeCopy, props);
}
