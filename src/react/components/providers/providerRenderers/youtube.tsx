import { createElement } from 'react';

import { YoutubePreview } from '../../previews/YoutubePreview';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderYoutubeVideoPreview = createVariantRenderer('youtube', ({ facts, localizedPreview }: VariantRendererProps<'youtube'>) => (
  <YoutubePreview videoId={facts.variant.videoId} title={facts.item.text || facts.item.title} preview={localizedPreview} onPreviewError={facts.onPreviewError} />
));

const renderYoutubeCopy = createVariantRenderer('youtube', ({ facts }: VariantRendererProps<'youtube'>) => (
  <div className="reader-card__copy reader-card__copy--player reader-card__youtube-copy">
    <h2 className="reader-card__title">{facts.item.text || facts.item.title}</h2>
    <p className="reader-card__channel">{facts.item.title.replace(/^YT:\s*/i, '').trim() || 'YouTube'}</p>
  </div>
), StandardCopy);

export function YoutubeVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeVideoPreview, props);
}

export function YoutubeCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeCopy, props);
}
