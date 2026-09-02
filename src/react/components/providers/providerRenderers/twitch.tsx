import { getTwitchStreamTitle } from '../../../domain/twitchPreview';
import { TwitchPreview } from '../../previews/TwitchPreview';
import { TwitchTitle } from '../../TwitchTitle';
import {
  type ProviderRendererProps,
} from './common';

export function TwitchVideoPreview({ facts, localizedPreview }: ProviderRendererProps<'twitch'>) {
  return <TwitchPreview channel={facts.channel} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
}

export function TwitchCopy({ facts }: ProviderRendererProps<'twitch'>) {
  const title = getTwitchStreamTitle(facts.item.title, facts.channel);
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__twitch-copy">
      <h2 className="reader-card__title"><TwitchTitle text={title} /></h2>
      <p className="reader-card__channel">{facts.channel}</p>
    </div>
  );
}
