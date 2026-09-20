import { YoutubePreview } from '../../previews/YoutubePreview';
import {
  type ProviderRendererProps,
} from './common';

export function YoutubeVideoPreview({ facts, localizedPreview }: ProviderRendererProps<'youtube'>) {
  const title = getYoutubeTitle(facts);
  return <YoutubePreview videoId={facts.videoId} title={title} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
}

export function YoutubeCopy({ facts }: ProviderRendererProps<'youtube'>) {
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__youtube-copy">
      <h2 className="reader-card__title">{getYoutubeTitle(facts)}</h2>
      <p className="reader-card__channel">{facts.item.title.replace(/^YT:\s*/i, '').trim() || 'YouTube'}</p>
    </div>
  );
}

function getYoutubeTitle(facts: ProviderRendererProps<'youtube'>['facts']): string {
  return facts.openGraphPreview?.title?.trim() || facts.item.text || facts.item.title;
}
