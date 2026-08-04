import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from './useFeedItemCardModel';
import { localizeFeedItemPreview } from './previewLocalization';
import { getFeedItemCardProviderRenderer } from './providers/feedItemCardProviderRegistry';

export function FeedItemCardPreview({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const localizedPreview = model.visiblePreview
    ? localizeFeedItemPreview(model.visiblePreview, t)
    : null;
  const { Preview: Renderer } = getFeedItemCardProviderRenderer(model.provider);

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

export function FeedItemCardIdentity({ model }: { model: FeedItemCardModel }) {
  const { Identity: Renderer } = getFeedItemCardProviderRenderer(model.provider);

  return <Renderer model={model} localizedPreview={null} displayHostname="" />;
}

export function FeedItemCardSupplementary({ model }: { model: FeedItemCardModel }) {
  const { Supplementary: Renderer } = getFeedItemCardProviderRenderer(model.provider);
  if (model.isPreviewPending) return null;

  return <Renderer model={model} localizedPreview={null} displayHostname="" />;
}

export function FeedItemCardCopy({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const { Copy: Renderer } = getFeedItemCardProviderRenderer(model.provider);
  if (model.isPreviewPending) return null;

  return (
    <Renderer
      model={model}
      localizedPreview={null}
      displayHostname={model.hostname ?? t('feed.item')}
    />
  );
}
