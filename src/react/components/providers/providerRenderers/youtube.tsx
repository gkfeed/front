import { YoutubePreview } from '../../previews/YoutubePreview';
import {
  type ProviderRendererProps,
} from './common';

export function YoutubeVideoPreview({ facts, localizedPreview }: ProviderRendererProps<'youtube'>) {
  return <YoutubePreview videoId={facts.videoId} title={facts.item.text || facts.item.title} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
}

export function YoutubeCopy({ facts }: ProviderRendererProps<'youtube'>) {
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__youtube-copy">
      <h2 className="reader-card__title">{facts.item.text || facts.item.title}</h2>
      <p className="reader-card__channel">{facts.item.title.replace(/^YT:\s*/i, '').trim() || 'YouTube'}</p>
    </div>
  );
}
