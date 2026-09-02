import { parseMatreshkaTitle } from '../../../domain/matreshkaTitle';
import { MatreshkaPreview } from '../../previews/MatreshkaPreview';
import {
  type ProviderRendererProps,
} from './common';

export function MatreshkaVideoPreview({ facts, localizedPreview }: ProviderRendererProps<'matreshka'>) {
  const title = parseMatreshkaTitle(facts.item.title, facts.item.text);
  return <MatreshkaPreview videoId={facts.videoId} title={title.title} videoSrc={facts.openGraphPreview?.video ?? null} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
}

export function MatreshkaCopy({ facts }: ProviderRendererProps<'matreshka'>) {
  const title = parseMatreshkaTitle(facts.item.title, facts.item.text);
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__matreshka-copy">
      <h2 className="reader-card__title">{title.title}</h2>
      {title.channel ? <p className="reader-card__channel">{title.channel}</p> : null}
    </div>
  );
}
