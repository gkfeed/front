import { InstagramIcon } from './Icons';
import { useTranslation } from 'react-i18next';
import {
  FeedItemCardCopy,
  FeedItemCardPreview,
  FeedItemCardSupplementary,
} from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';

export function FeedItemCard({ item }: { item: Parameters<typeof useFeedItemCardModel>[0] }) {
  const { t } = useTranslation();
  const model = useFeedItemCardModel(item);
  const {
    cardRef,
    isPreviewPending,
    variant,
    imagePreview,
    shouldBlurNsfw,
    shouldHideNsfw,
  } = model;

  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        variant.type === 'liquipedia' ? 'reader-card--liquipedia' : '',
        variant.type === 'youtube' ? 'reader-card--youtube' : '',
        variant.type === 'tiktok' || variant.type === 'instagram' ? 'reader-card--short-video' : '',
        variant.type === 'tiktok' ? 'reader-card--tiktok' : '',
        variant.type === 'instagram' ? 'reader-card--instagram' : '',
        variant.type === 'instagram' && variant.media === 'photo' ? 'reader-card--instagram-photo' : '',
        variant.type === 'simple-image' ? 'reader-card--simple-image' : '',
        imagePreview.type !== 'none' ? 'reader-card--image-preview' : '',
        imagePreview.type === 'generated' && imagePreview.source === 'reddit' ? 'reader-card--reddit-preview' : '',
        imagePreview.type === 'hltv' ? 'reader-card--hltv-preview' : '',
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
      {variant.type === 'instagram' ? (
        <div className="reader-card__short-video-identity">
          <span className="reader-card__short-video-logo"><InstagramIcon /></span>
          <span>{getInstagramUsername(item.title)}</span>
        </div>
      ) : null}
      <FeedItemCardPreview model={model} />
      <FeedItemCardSupplementary model={model} />
      <FeedItemCardCopy model={model} />
    </article>
  );
}

function getInstagramUsername(title: string): string {
  return title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
}
