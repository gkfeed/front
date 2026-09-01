import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../../previewLocalization';
import { ArticleReaderLink } from '../../ArticleReader';
import { FeedItemMedia } from '../../previews/FeedItemMedia';

export type FeedItemCardProviderRendererProps = {
  model: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  onOpenArticle?: () => void;
};

export type FeedItemCardProviderRenderer = {
  cardClassNames: (model: FeedItemCardModel) => readonly string[];
  Preview: ComponentType<FeedItemCardProviderRendererProps>;
  Supplementary: ComponentType<FeedItemCardProviderRendererProps>;
  Copy: ComponentType<FeedItemCardProviderRendererProps>;
  Identity: ComponentType<FeedItemCardProviderRendererProps>;
};

export function EmptyRenderer(): null {
  return null;
}

export function FeedItemMediaPreview({
  model,
  localizedPreview,
  displayHostname,
}: FeedItemCardProviderRendererProps) {
  if (!localizedPreview || model.descriptor.preview.type !== 'media') return null;

  return (
    <FeedItemMedia
      href={model.item.link}
      hostname={model.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={model.descriptor.preview.isShortVideo}
      isTikTok={model.descriptor.preview.isTikTok}
      hltvImageScore={model.hltvImageScore}
      onPreviewError={model.onPreviewError}
      useRoundedImageSurface={model.provider === 'vk'}
      isVk={model.provider === 'vk'}
    />
  );
}

export function StandardCopy({ model, displayHostname, onOpenArticle }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  const { item, description } = model;

  if (model.descriptor.copy === 'simple-image') {
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
        enabled={model.canReadArticle}
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

export type VariantRendererProps<T extends FeedItemCardModel['variant']['type']> = Omit<
  FeedItemCardProviderRendererProps,
  'model'
> & {
  model: Omit<FeedItemCardModel, 'variant'> & {
    variant: Extract<FeedItemCardModel['variant'], { type: T }>;
  };
};
