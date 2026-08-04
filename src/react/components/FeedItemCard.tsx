import { useTranslation } from 'react-i18next';
import {
  FeedItemCardCopy,
  FeedItemCardIdentity,
  FeedItemCardPreview,
  FeedItemCardSupplementary,
} from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';

export function FeedItemCard({ item }: { item: Parameters<typeof useFeedItemCardModel>[0] }) {
  const { t } = useTranslation();
  const model = useFeedItemCardModel(item);
  const { cardRef, isPreviewPending, descriptor, shouldBlurNsfw, shouldHideNsfw } = model;

  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        descriptor.className,
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      inert={shouldBlurNsfw}
    >
      {shouldBlurNsfw ? (
        <div className="reader-card__nsfw-shield" aria-hidden="true">
          <strong>NSFW</strong>
          <span>{t('preview.hidden')}</span>
        </div>
      ) : null}
      <FeedItemCardIdentity model={model} />
      <FeedItemCardPreview model={model} />
      <FeedItemCardSupplementary model={model} />
      <FeedItemCardCopy model={model} />
    </article>
  );
}
