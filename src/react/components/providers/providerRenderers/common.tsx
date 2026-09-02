import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../../previewLocalization';
import { ArticleReaderLink } from '../../ArticleReader';
import { FeedItemMedia } from '../../previews/FeedItemMedia';

export type FeedItemCardProviderRendererProps = {
  facts: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  onOpenArticle?: () => void;
};

export type FeedItemCardProviderRenderer = {
  cardClassNames: (facts: FeedItemCardModel) => readonly string[];
  Preview: ComponentType<FeedItemCardProviderRendererProps>;
  Supplementary: ComponentType<FeedItemCardProviderRendererProps>;
  Copy: ComponentType<FeedItemCardProviderRendererProps>;
  Identity: ComponentType<FeedItemCardProviderRendererProps>;
};

export function EmptyRenderer(): null {
  return null;
}

export function FeedItemMediaPreview({
  facts,
  localizedPreview,
  displayHostname,
}: FeedItemCardProviderRendererProps) {
  if (!localizedPreview || facts.descriptor.preview.type !== 'media') return null;

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={facts.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={facts.descriptor.preview.isShortVideo}
      isTikTok={facts.descriptor.preview.isTikTok}
      hltvImageScore={facts.hltvImageScore}
      onPreviewError={facts.onPreviewError}
      imagePresentation={facts.descriptor.imagePresentation}
    />
  );
}

export function StandardCopy({ facts, displayHostname, onOpenArticle }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  const { item, description } = facts;

  if (facts.descriptor.copy === 'simple-image') {
    return (
      <div className="reader-card__copy">
        <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      </div>
    );
  }

  return (
    <div className="reader-card__copy">
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <ArticleReaderLink
        url={item.link}
        enabled={facts.canReadArticle}
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

export type VariantRendererProps<T extends FeedItemCardModel['variant']['type']> = Omit<
  FeedItemCardProviderRendererProps,
  'facts'
> & {
  facts: Omit<FeedItemCardModel, 'variant'> & {
    variant: Extract<FeedItemCardModel['variant'], { type: T }>;
  };
};
