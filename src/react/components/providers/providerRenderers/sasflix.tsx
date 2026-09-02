import { SasflixPreview } from '../../previews/SasflixPreview';
import {
  type ProviderRendererProps,
} from './common';

export function SasflixVideoPreview({ facts, localizedPreview }: ProviderRendererProps<'sasflix'>) {
  return <SasflixPreview href={facts.item.link} title={facts.item.title} videoSrc={facts.openGraphPreview?.video ?? null} previewStatus={facts.previewStatus} preview={localizedPreview} onPreviewError={facts.onPreviewError} />;
}

export function SasflixCopy({ facts }: ProviderRendererProps<'sasflix'>) {
  return (
    <div className="reader-card__copy reader-card__copy--player reader-card__sasflix-copy">
      <h2 className="reader-card__title">{facts.item.title}</h2>
    </div>
  );
}
