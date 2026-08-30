import { createElement } from 'react';

import { getTwitchStreamTitle } from '../../../domain/twitchPreview';
import { TwitchPreview } from '../../previews/TwitchPreview';
import { TwitchTitle } from '../../TwitchTitle';
import {
  StandardCopy,
  type FeedItemCardProviderRendererProps,
  type VariantRendererProps,
} from './common';
import { createVariantRenderer } from './createVariantRenderer';

const renderTwitchVideoPreview = createVariantRenderer('twitch', ({ model, localizedPreview }: VariantRendererProps<'twitch'>) => (
  <TwitchPreview channel={model.variant.channel} preview={localizedPreview} onPreviewError={model.onPreviewError} />
));

const renderTwitchCopy = createVariantRenderer('twitch', ({ model }: VariantRendererProps<'twitch'>) => {
  const title = getTwitchStreamTitle(model.item.title, model.variant.channel);
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__twitch-copy">
      <h2 className="reader-card__title"><TwitchTitle text={title} /></h2>
      <p className="reader-card__channel">{model.variant.channel}</p>
    </div>
  );
}, StandardCopy);

export function TwitchVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderTwitchVideoPreview, props);
}

export function TwitchCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderTwitchCopy, props);
}
