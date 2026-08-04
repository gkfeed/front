import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from './useFeedItemCardModel';
import { localizeFeedItemPreview } from './previewLocalization';
import { getFeedItemCardProviderRenderer } from './providers/feedItemCardProviderRegistry';

export function FeedItemCardPreview({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const localizedPreview = model.visiblePreview
    ? localizeFeedItemPreview(model.visiblePreview, t)
    : null;
  const Renderer = getFeedItemCardProviderRenderer(model.provider).Preview;

  if (model.isPreviewPending) {
    return <div className="reader-card__preview-placeholder" role="status" aria-label={t('preview.loading')} />;
  }

  return (
    <Renderer
      model={model}
      localizedPreview={localizedPreview}
      displayHostname={model.hostname ?? t('feed.item')}
    />
  );
}

export function FeedItemCardSupplementary({ model }: { model: FeedItemCardModel }) {
  const Renderer = getFeedItemCardProviderRenderer(model.provider).Supplementary;
  if (model.isPreviewPending) return null;

  return <Renderer model={model} localizedPreview={null} displayHostname="" />;
}

export function FeedItemCardCopy({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const Renderer = getFeedItemCardProviderRenderer(model.provider).Copy;
  if (model.isPreviewPending || model.descriptor.copy === 'none') return null;

  return (
    <Renderer
      model={model}
      localizedPreview={null}
      displayHostname={model.hostname ?? t('feed.item')}
    />
  );
}
