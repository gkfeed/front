import { createElement } from 'react';

import { parseMatreshkaTitle } from '../../../domain/matreshkaTitle';
import { MatreshkaPreview } from '../../previews/MatreshkaPreview';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderMatreshkaVideoPreview = createVariantRenderer('matreshka', ({ facts, localizedPreview }: VariantRendererProps<'matreshka'>) => {
  const title = parseMatreshkaTitle(facts.item.title, facts.item.text);
  return <MatreshkaPreview videoId={facts.variant.videoId} title={title.title} videoSrc={facts.videoSrc} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
});

const renderMatreshkaCopy = createVariantRenderer('matreshka', ({ facts }: VariantRendererProps<'matreshka'>) => {
  const title = parseMatreshkaTitle(facts.item.title, facts.item.text);
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__matreshka-copy">
      <h2 className="reader-card__title">{title.title}</h2>
      {title.channel ? <p className="reader-card__channel">{title.channel}</p> : null}
    </div>
  );
}, StandardCopy);

export function MatreshkaVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderMatreshkaVideoPreview, props);
}

export function MatreshkaCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderMatreshkaCopy, props);
}
